<?php

namespace App\Console\Commands;

use App\Models\Organization;
use App\Models\TransactionCategory;
use App\Services\OrganizationService;
use App\Services\SavingsService;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Copies the old money-manager schema into this app's schema (same Postgres DB).
 * Source is only ever SELECTed. Target must be empty. All-or-nothing (one transaction).
 */
class ImportLegacy extends Command
{
    protected $signature = 'legacy:import {--schema=money_manager_db : old app schema} {--verify : only compare totals}';

    protected $description = 'Copy users, groups, categories, transactions and rules from the old money-manager schema';

    public function handle(): int
    {
        $src = $this->option('schema');
        $dst = DB::selectOne('SELECT current_schema() AS s')->s;
        if (DB::getDriverName() !== 'pgsql' || ! preg_match('/^\w+$/', $src) || $src === $dst) {
            $this->error("Need pgsql and a source schema different from the target ($dst).");

            return self::FAILURE;
        }
        $s = fn (string $t) => "\"$src\".$t";
        foreach ($this->option('verify') ? [] : ['users', 'organizations', 'transactions'] as $t) {
            if (DB::table($t)->exists()) {
                $this->error("Target $dst.$t is not empty. Refusing to import.");

                return self::FAILURE;
            }
        }

        $this->option('verify') || DB::transaction(function () use ($s) {
            // Users: same ids, same bcrypt hashes → same logins.
            DB::insert('INSERT INTO users (id, name, email, email_verified_at, password, remember_token, created_at, updated_at)
                SELECT id, name, email, email_verified_at, password, remember_token, created_at, updated_at FROM '.$s('users'));

            // Groups → organizations (+ memberships).
            $members = collect(DB::select('SELECT * FROM '.$s('group_user').' ORDER BY id'))->groupBy('group_id');
            foreach (DB::select('SELECT * FROM '.$s('groups').' ORDER BY id') as $g) {
                $gm = $members[$g->id] ?? collect();
                $owner = $g->owner_id ?? $gm->firstWhere('role', 'owner')?->user_id ?? $gm->first()?->user_id;
                if (! $owner) {
                    $this->warn("Skipped group {$g->id} ({$g->name}): no owner or members.");

                    continue;
                }
                DB::table('organizations')->insert([
                    'id' => $g->id, 'name' => $g->name, 'slug' => OrganizationService::uniqueSlug($g->name), 'owner_id' => $owner,
                    'plan' => 'free', 'created_at' => $g->created_at, 'updated_at' => $g->updated_at,
                    'settings' => json_encode(array_filter([
                        'timezone' => 'Asia/Jakarta', 'currency' => 'IDR', 'date_format' => 'd M Y', 'onboarded' => true,
                        'goal_amount' => $g->goal_amount, 'description' => $g->description,
                    ], fn ($v) => $v !== null)),
                ]);
                if (! $gm->contains('user_id', $owner)) {
                    $gm->push((object) ['user_id' => $owner, 'role' => 'owner', 'created_at' => $g->created_at]);
                }
                foreach ($gm as $m) {
                    $role = $m->user_id == $owner ? 'owner' : (in_array($m->role, ['admin', 'member', 'viewer'], true) ? $m->role : 'member');
                    DB::table('memberships')->insert([
                        'organization_id' => $g->id, 'user_id' => $m->user_id, 'role' => $role,
                        'joined_at' => $m->created_at ?? now(), 'invitation_accepted_at' => $m->created_at ?? now(),
                    ]);
                }
            }
            $orgIds = DB::table('organizations')->pluck('id')->all();
            DB::statement('UPDATE users u SET current_organization_id = (SELECT MIN(organization_id) FROM memberships m WHERE m.user_id = u.id)');

            // Categories: same ids; old app had no icon/colour.
            $palette = collect(TransactionCategory::DEFAULTS)->flatten(1)->pluck(2)->unique()->values();
            $order = [];
            foreach (DB::select('SELECT * FROM '.$s('transaction_categories').' ORDER BY group_id, type, id') as $i => $c) {
                if (! in_array($c->group_id, $orgIds)) {
                    continue;
                }
                $n = $order[$c->group_id.$c->type] = ($order[$c->group_id.$c->type] ?? -1) + 1;
                DB::table('transaction_categories')->insert([
                    'id' => $c->id, 'organization_id' => $c->group_id, 'type' => $c->type, 'name' => $c->name,
                    'icon' => TransactionCategory::emojiFor($c->name), 'color' => $palette[$i % $palette->count()], 'sort_order' => $n,
                    'created_at' => $c->created_at, 'updated_at' => $c->updated_at,
                ]);
            }

            // Transactions: same ids, soft deletes kept. A category of the wrong type is swapped for the same-named one of the right type.
            DB::insert('INSERT INTO transactions (id, organization_id, user_id, category_id, type, amount, currency, description, actor, transaction_time, proof_url, source, created_at, updated_at, deleted_at)
                SELECT t.id, t.group_id, t.user_id,
                    CASE WHEN c.type = t.type AND c.group_id = t.group_id THEN t.category_id
                         ELSE (SELECT c2.id FROM '.$s('transaction_categories').' c2 WHERE c2.group_id = t.group_id AND c2.type = t.type AND LOWER(c2.name) = LOWER(c.name) LIMIT 1) END,
                    t.type, t.amount, \'IDR\', t.description, t.actor, t.transaction_time, t.proof, \'import\', t.created_at, t.updated_at, t.deleted_at
                FROM '.$s('transactions').' t LEFT JOIN '.$s('transaction_categories').' c ON c.id = t.category_id
                WHERE t.group_id IN ('.implode(',', array_map('intval', $orgIds)).')');

            // Per-user rules → their organization's rules/bills. Owner's rules first so their payday wins primary.
            $orgOf = DB::table('memberships')->orderBy('organization_id')->get()->groupBy('user_id')->map(fn ($m) => $m->first()->organization_id);
            $owners = DB::table('organizations')->pluck('owner_id', 'id');
            $rules = collect(DB::select('SELECT * FROM '.$s('user_rules').' ORDER BY id'))
                ->sortBy(fn ($r) => [isset($orgOf[$r->user_id]) && $owners[$orgOf[$r->user_id]] == $r->user_id ? 0 : 1, ! $r->is_primary, $r->id]);
            $seen = [];
            $primary = [];
            $skipped = 0;
            foreach ($rules as $r) {
                $org = $orgOf[$r->user_id] ?? null;
                $day = (int) $r->date_condition; // "23-31" → 23
                if (! $org) {
                    $skipped++;

                    continue;
                }
                if ($r->type === 'expense_limit') {
                    $type = $r->period === 'week' ? 'weekly_limit' : 'monthly_limit';
                    $key = implode('|', [$org, $type, mb_strtolower((string) $r->category_name), $r->amount]);
                    if (isset($seen[$key])) {
                        continue; // identical limit set by two members
                    }
                    $seen[$key] = true;
                    DB::table('user_rules')->insert([
                        'organization_id' => $org, 'name' => $r->category_name ?? 'Budget', 'type' => $type, 'limit_amount' => $r->amount ?? 0,
                        'period' => $r->period, 'category_name' => $r->category_name, 'created_at' => $r->created_at, 'updated_at' => $r->updated_at,
                    ]);
                } elseif ($r->type === 'payday') {
                    $isPrimary = $r->is_primary && ! isset($primary[$org]);
                    $primary[$org] = $primary[$org] ?? $isPrimary;
                    DB::table('user_rules')->insert([
                        'organization_id' => $org, 'name' => $r->category_name ?? 'Gajian', 'type' => 'payday', 'limit_amount' => $r->amount ?? 0,
                        'period' => 'month', 'is_primary_payday' => $isPrimary, 'date_condition' => $day ?: null,
                        'category_name' => $r->category_name, 'created_at' => $r->created_at, 'updated_at' => $r->updated_at,
                    ]);
                } elseif ($r->type === 'reminder' && $day) {
                    $today = CarbonImmutable::now('Asia/Jakarta')->startOfDay();
                    $due = $today->setDay(min($day, $today->daysInMonth));
                    if ($due->lt($today)) {
                        $next = $today->startOfMonth()->addMonth();
                        $due = $next->setDay(min($day, $next->daysInMonth));
                    }
                    DB::table('bills')->insert([
                        'organization_id' => $org, 'name' => $r->category_name ?? 'Tagihan', 'amount' => $r->amount ?? 0, 'currency' => 'IDR',
                        'due_date' => $due->toDateString(), 'recurrence' => 'monthly', 'created_at' => $r->created_at, 'updated_at' => $r->updated_at,
                    ]);
                } else {
                    $skipped++;
                }
            }

            foreach (['users', 'organizations', 'memberships', 'transaction_categories', 'transactions', 'user_rules', 'bills'] as $t) {
                DB::statement("SELECT setval(pg_get_serial_sequence('$t', 'id'), GREATEST((SELECT MAX(id) FROM $t), 1))");
            }

            // Savings: recomputed per org payday cycle from the first transaction to now (old rows were per user).
            foreach (Organization::all() as $org) {
                $at = $org->transactions()->min('transaction_time');
                for ($i = 0; $at && $i < 600 && CarbonImmutable::parse($at)->lte(now()); $i++) {
                    $sv = SavingsService::recordForOrganization($org, CarbonImmutable::parse($at));
                    $at = CarbonImmutable::parse($sv->cycle_end, $org->timezone())->addDay()->startOfDay();
                }
            }
            $this->line("Rules skipped (no org / unknown type): $skipped");
        });

        // Verification: per org, counts and sums must match the source exactly.
        $ok = true;
        foreach (DB::select('SELECT group_id g, type, COUNT(*) n, COUNT(deleted_at) d, SUM(amount) a FROM '.$s('transactions').' GROUP BY 1, 2 ORDER BY 1, 2') as $r) {
            $t = DB::selectOne('SELECT COUNT(*) n, COUNT(deleted_at) d, SUM(amount) a FROM transactions WHERE organization_id = ? AND type = ?', [$r->g, $r->type]);
            $match = $t->n == $r->n && $t->d == $r->d && DB::selectOne('SELECT ?::numeric = ?::numeric AS eq', [$t->a, $r->a])->eq;
            $ok = $ok && $match;
            $this->line(sprintf('org %d %-7s src %5d tx (%d deleted) %16s | dst %5d (%d) %16s %s', $r->g, $r->type, $r->n, $r->d, $r->a, $t->n, $t->d, $t->a, $match ? 'OK' : 'MISMATCH'));
        }
        foreach (['users', 'organizations', 'memberships', 'transaction_categories', 'user_rules', 'bills', 'savings'] as $t) {
            $this->line("$t: ".DB::table($t)->count());
        }
        $ok ? $this->info('Import complete, totals match.') : $this->error('Totals mismatch, check above.');

        return $ok ? self::SUCCESS : self::FAILURE;
    }
}
