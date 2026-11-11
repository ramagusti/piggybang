<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Services\AiClient;
use App\Services\BudgetService;
use App\Services\PaydayService;
use App\Support\Memo;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Log;

/**
 * AI files transactions into AI rules (UserRule::ai_assign), stored as metadata.budget (rule id, 0 = none):
 * expenses into spending budgets, income into payday rules (is this that salary?).
 * Runs for transactions added or edited outside WhatsApp, and for the whole cycle when an AI rule changes.
 */
class AssignBudget implements ShouldQueue
{
    use Queueable;

    public const BATCH = 25;

    public int $tries = 2;

    public int $timeout = 120; // the AI call may take up to 60s; the worker's default limit is also 60s

    /** @param list<int> $transactionIds */
    public function __construct(public int $organizationId, public array $transactionIds) {}

    /** Re-file this cycle's expenses and the income that can move the payday, e.g. after an AI rule was added, edited or removed. */
    public static function forCycle(Organization $org): void
    {
        foreach (self::cycleBatches($org) as $ids) {
            self::dispatch($org->id, $ids);
        }
    }

    /** @return list<list<int>> */
    public static function cycleBatches(Organization $org): array
    {
        [$start, $end] = PaydayService::cycle($org);

        return $org->transactions()
            ->where(fn ($q) => $q->where('type', 'expense')->whereBetween('transaction_time', [$start->utc(), $end->utc()])
                ->orWhere(fn ($q) => $q->where('type', 'income')->where('transaction_time', '>=', $start->subDays(PaydayService::EARLY_DAYS)->utc())))
            ->pluck('id')->chunk(self::BATCH)->map(fn ($ids) => $ids->values()->all())->all();
    }

    /** @return array{sent: int, picked: int, none: int} how many went to the AI, got a rule, got "none" (for budgets:assign) */
    public function handle(): array
    {
        $stats = ['sent' => 0, 'picked' => 0, 'none' => 0];
        $org = Organization::find($this->organizationId);
        if (! $org) {
            return $stats;
        }
        $txs = $org->transactions()->with('category')->whereKey($this->transactionIds)->get();
        foreach ($txs->groupBy('type') as $type => $group) {
            $rules = BudgetService::aiRules($org, $type);
            if ($rules->isEmpty()) {
                continue;
            }
            $text = fn ($tx) => $type === 'income' ? BudgetService::incomeText($tx->category?->name, $tx->description) : $tx->description;
            // Only transactions some AI rule could take (its category/keywords) need the AI; the rest go nowhere.
            $candidates = $group->filter(fn ($tx) => $rules->contains(fn ($r) => BudgetService::fits($r, $tx->category_id, $text($tx))));
            if ($candidates->isNotEmpty() && ! AiClient::configured()) {
                continue;
            }
            $picks = $candidates->isNotEmpty() ? $this->ask($org, $rules, $candidates) : [];
            $stats['sent'] += $candidates->count();
            foreach ($group as $tx) {
                $pick = $candidates->contains('id', $tx->id) ? ($picks[$tx->id] ?? null) : 0;
                if ($pick === null) {
                    continue; // the AI skipped it: keep what it had
                }
                $pick = $rules->contains('id', $pick) ? $pick : 0;
                $candidates->contains('id', $tx->id) && $stats[$pick ? 'picked' : 'none']++;
                $tx->metadata = ['budget' => $pick] + ($tx->metadata ?? []);
                $tx->saveQuietly(); // bookkeeping, not a user edit: no audit entry or webhook
            }
        }
        Memo::flush(); // saveQuietly skips the model events that normally flush it

        return $stats;
    }

    /** @return array<int, int> transaction id → rule id (0 = none) */
    private function ask(Organization $org, $rules, $txs): array
    {
        $out = AiClient::json([
            ['role' => 'system', 'content' => "You file transactions of a family finance app into the rules below. Reply ONLY JSON {\"picks\":{\"<transaction id>\":rule id or null}} with one entry per transaction, e.g. {\"picks\":{\"3088\":8,\"3089\":null}}.\n"
                .BudgetService::aiPrompt($rules)],
            ['role' => 'user', 'content' => json_encode($txs->map(fn ($tx) => [
                'id' => $tx->id, 'type' => $tx->type, 'description' => $tx->description, 'category' => $tx->category?->name,
                'amount' => $tx->amount.' '.$tx->currency, 'by' => $tx->actor,
                'when' => $tx->transaction_time->copy()->setTimezone($org->timezone())->toDayDateTimeString(),
            ])->values(), JSON_UNESCAPED_UNICODE)],
        ], null, 60);
        $picks = self::parsePicks($out);
        if (count($picks) < $txs->count()) {
            Log::warning('AssignBudget: AI answered '.count($picks).' of '.$txs->count().' picks', ['org' => $org->id, 'output' => $out]);
        }

        return $picks;
    }

    /**
     * Models don't always keep the asked-for shape. Accepts {"picks":[{id, budget_id}]}, a bare list of those,
     * or a map {"<transaction id>": budget id | {budget_id}}.
     *
     * @return array<int, int>
     */
    public static function parsePicks(array $out): array
    {
        $list = $out['picks'] ?? $out;
        if (! array_is_list($list)) {
            $list = collect($list)->map(fn ($v, $id) => ['id' => $id, 'budget_id' => is_array($v) ? ($v['budget_id'] ?? null) : $v])->values()->all();
        }

        return collect($list)->filter(fn ($p) => is_array($p) && is_numeric($p['id'] ?? null))
            ->mapWithKeys(fn ($p) => [(int) $p['id'] => (int) ($p['budget_id'] ?? 0)])->all();
    }
}
