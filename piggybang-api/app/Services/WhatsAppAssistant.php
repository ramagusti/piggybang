<?php

namespace App\Services;

use App\Models\ExchangeRate;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Answers WhatsApp questions from the team's own data. The AI only classifies the question into `ask`
 * (topic + filters); every number here comes from the database, so the bot can't invent figures.
 * Access mirrors the web app: everyone in the team can read; payment details need billing.manage.
 */
class WhatsAppAssistant
{
    public const TOPICS = ['transactions', 'budgets', 'bills', 'savings', 'categories', 'billing', 'members', 'help'];

    public static function rules(): array
    {
        return [
            'intent' => ['nullable', 'in:record,ask,other'],
            'ask' => ['nullable', 'array'],
            'ask.topic' => ['required_with:ask', 'in:'.implode(',', self::TOPICS)],
            'ask.scope' => ['nullable', 'in:me,team'],
            'ask.type' => ['nullable', 'in:expense,income,all'],
            'ask.category' => ['nullable', 'string', 'max:100'],
            'ask.keyword' => ['nullable', 'string', 'max:100'],
            'ask.member' => ['nullable', 'string', 'max:100'],
            'ask.from' => ['nullable', 'date'],
            'ask.to' => ['nullable', 'date'],
        ];
    }

    public static function answer(Organization $org, ?User $user, ?Membership $membership, array $ask): string
    {
        return match ($ask['topic']) {
            'transactions' => self::transactions($org, $user, $ask),
            'budgets' => self::budgets($org, array_filter([$ask['keyword'] ?? null, $ask['category'] ?? null])),
            'bills' => self::bills($org, array_filter([$ask['keyword'] ?? null, $ask['category'] ?? null])),
            'savings' => self::savings($org),
            'categories' => self::categories($org),
            'billing' => self::billing($org, $membership),
            'members' => self::members($org),
            default => self::help(),
        };
    }

    private static function transactions(Organization $org, ?User $user, array $ask): string
    {
        $tz = $org->timezone();
        [$cycleStart, $cycleEnd] = PaydayService::cycle($org);
        $from = ! empty($ask['from']) ? CarbonImmutable::parse($ask['from'], $tz)->startOfDay() : $cycleStart;
        $to = ! empty($ask['to']) ? CarbonImmutable::parse($ask['to'], $tz)->endOfDay() : $cycleEnd;
        $type = in_array($ask['type'] ?? null, ['expense', 'income'], true) ? $ask['type'] : null;

        $q = $org->transactions()->whereBetween('transaction_time', [$from->utc(), $to->utc()]);
        $who = 'tim';
        if (($ask['scope'] ?? 'team') === 'me' && $user) {
            $q->where('transactions.user_id', $user->id);
            $who = 'kamu';
        }
        if (! empty($ask['member'])) {
            $name = mb_strtolower(trim($ask['member']));
            $ids = $org->memberships()->whereNotNull('user_id')->with('user')->get()->pluck('user')
                ->filter(fn ($u) => str_contains(mb_strtolower($u->name), $name))->pluck('id');
            $q->where(fn ($w) => $w->whereIn('transactions.user_id', $ids)->orWhereRaw('LOWER(actor) LIKE ?', ["%$name%"]));
            $who = $ask['member'];
        }
        $label = '';
        if (! empty($ask['category'])) {
            $cat = $org->categories()->when($type, fn ($c) => $c->where('type', $type))->get()
                ->first(fn ($c) => str_contains(mb_strtolower($c->name), mb_strtolower(trim($ask['category']))));
            if (! $cat) {
                return "🐷 Kategori \"{$ask['category']}\" tidak ketemu. Ketik \"kategori\" untuk lihat daftarnya.";
            }
            $q->where('category_id', $cat->id);
            $label = " · {$cat->name}";
        }
        if (! empty($ask['keyword'])) {
            $q->whereRaw('LOWER(description) LIKE ?', ['%'.mb_strtolower(trim($ask['keyword'])).'%']);
            $label .= " · \"{$ask['keyword']}\"";
        }

        $cur = $org->currency();
        $rows = (clone $q)->reorder()->selectRaw('type, currency, COUNT(*) AS n, SUM(amount) AS total')->groupBy('type', 'currency')->toBase()->get();
        $sum = fn ($t) => $rows->where('type', $t)->sum(fn ($r) => (float) $r->total * ExchangeRate::rate($r->currency, $cur));
        $count = fn ($t) => (int) $rows->where('type', $t)->sum('n');

        $lines = ['📊 *Transaksi '.$who.'*'.$label.' · '.self::range($from, $to)];
        foreach (['expense' => '🔴 Pengeluaran', 'income' => '🟢 Pemasukan'] as $t => $title) {
            if (! $type || $type === $t) {
                $lines[] = "$title: *".WhatsAppService::rupiah($sum($t)).'* ('.$count($t).' transaksi)';
            }
        }
        if ($rows->isEmpty()) {
            return implode("\n", $lines)."\n\nBelum ada transaksi di periode ini.";
        }
        if (empty($ask['category'])) {
            $byCat = (clone $q)->reorder()->where('transactions.type', $type ?? 'expense')
                ->leftJoin('transaction_categories as c', 'c.id', '=', 'transactions.category_id')
                ->selectRaw('c.name, SUM(transactions.amount) AS total')->groupBy('c.name')->orderByDesc('total')->limit(5)->toBase()->get();
            if ($byCat->isNotEmpty()) {
                $lines[] = "\nTeratas per kategori:";
                foreach ($byCat as $r) {
                    $lines[] = '• '.($r->name ?? 'Tanpa kategori').' '.WhatsAppService::rupiah($r->total);
                }
            }
        }
        $lines[] = "\nTerbaru:";
        foreach ((clone $q)->with('category')->latest('transaction_time')->limit(5)->get() as $tx) {
            $lines[] = '• '.$tx->transaction_time->copy()->setTimezone($tz)->format('j/n').' · '.($tx->description ?: ($tx->category?->name ?? '-'))
                .' · '.($tx->type === 'income' ? '+' : '').WhatsAppService::rupiah($tx->amount).($tx->actor ? " · {$tx->actor}" : '');
        }

        return implode("\n", $lines);
    }

    /** Items whose names contain the first term that matches anything; all items when none do. */
    private static function narrow($items, array $terms, callable $names)
    {
        foreach ($terms as $term) {
            $term = mb_strtolower(trim((string) $term));
            $hits = $items->filter(fn ($i) => collect($names($i))->contains(fn ($n) => $n && str_contains(mb_strtolower($n), $term)));
            if ($term !== '' && $hits->isNotEmpty()) {
                return $hits;
            }
        }

        return $items;
    }

    private static function budgets(Organization $org, array $terms = []): string
    {
        $rules = $org->rules()->with('category')->orderBy('type')->orderBy('id')->get();
        if ($rules->isEmpty()) {
            return '🎯 Belum ada anggaran. Buat di menu Anggaran supaya Piggy bisa kasih tahu sisa jatahnya.';
        }
        $limits = self::narrow($rules->whereIn('type', ['weekly_limit', 'monthly_limit']), $terms, fn ($r) => [$r->name, $r->category?->name, $r->category_name]);
        $narrowed = $limits->count() < $rules->whereIn('type', ['weekly_limit', 'monthly_limit'])->count();
        $lines = ['🎯 *Anggaran*'];
        foreach ($limits as $rule) {
            $p = BudgetService::progress($org, $rule);
            $icon = $p['percent'] > 100 ? '🔴' : ($p['percent'] >= 80 ? '🟠' : '🟢');
            $left = (float) $p['remaining'] < 0 ? 'lewat '.WhatsAppService::rupiah(abs((float) $p['remaining'])) : 'sisa '.WhatsAppService::rupiah($p['remaining']);
            $lines[] = "$icon {$rule->name} (".($rule->type === 'weekly_limit' ? 'mingguan' : 'per siklus')."): $left dari ".WhatsAppService::rupiah($p['effective_limit']);
        }
        if ($narrowed) {
            return implode("\n", $lines);
        }
        [$s, $e] = PaydayService::cycle($org);
        foreach ($rules->where('type', 'payday') as $rule) {
            $lines[] = "💰 {$rule->name}: tanggal {$rule->date_condition}".($rule->is_primary_payday ? ' (utama)' : '');
        }
        $lines[] = '🗓️ Siklus sekarang: '.self::range($s, $e);

        return implode("\n", $lines);
    }

    private static function bills(Organization $org, array $terms = []): string
    {
        $bills = self::narrow($org->bills()->where('is_active', true)->orderBy('due_date')->get(), $terms, fn ($b) => [$b->name])->take(8);
        if ($bills->isEmpty()) {
            return '📋 Belum ada tagihan aktif. Tambahkan di menu Tagihan supaya Piggy bisa mengingatkan.';
        }
        $lines = ['📋 *Tagihan*'];
        foreach ($bills as $b) {
            $d = $b->daysUntilDue();
            $when = $d < 0 ? 'telat '.abs($d).' hari' : ($d === 0 ? 'hari ini' : "$d hari lagi");
            $lines[] = '• '.$b->name.' '.WhatsAppService::rupiah($b->amount).' · '.$when.' ('.$b->due_date->format('j/n').')'
                .($b->destination_number ? " · {$b->destination_account} {$b->destination_number}" : '');
        }

        return implode("\n", $lines);
    }

    private static function savings(Organization $org): string
    {
        $s = SavingsService::current($org);
        $net = (float) $s['net_savings'];
        $trend = ['improving' => 'membaik 📈', 'worsening' => 'menurun 📉', 'flat' => 'sama saja'][$s['trend']];

        return implode("\n", array_filter([
            '🐷 *Tabungan siklus ini* · '.self::range(CarbonImmutable::parse($s['cycle_start']), CarbonImmutable::parse($s['cycle_end'])),
            '🟢 Pemasukan: '.WhatsAppService::rupiah($s['income_total']),
            '🔴 Pengeluaran: '.WhatsAppService::rupiah($s['expense_total']),
            ($net < 0 ? '⚠️ Tabungan: *MINUS ' : '✅ Tabungan: *').WhatsAppService::rupiah(abs($net)).'*',
            $s['previous_net'] !== null ? 'Siklus lalu: '.WhatsAppService::rupiah($s['previous_net'])." ($trend)" : null,
            (float) $s['income_total'] > 0 ? "Terpakai {$s['progress_pct']}% dari pemasukan." : null,
        ]));
    }

    private static function categories(Organization $org): string
    {
        $cats = $org->categories()->orderBy('sort_order')->get();
        $fmt = fn ($type) => $cats->where('type', $type)->map(fn ($c) => trim("{$c->icon} {$c->name}"))->implode(', ');

        return "🗂️ *Kategori*\n🔴 Pengeluaran: ".$fmt('expense')."\n🟢 Pemasukan: ".$fmt('income');
    }

    private static function billing(Organization $org, ?Membership $membership): string
    {
        $sub = $org->currentSubscription();
        $tier = $org->plan === 'pro' ? config('billing.tiers.'.($sub?->tier ?? 'pro').'.name', 'Pro') : ($org->isTrialing() ? 'Pro (trial)' : 'Free');
        $used = (int) $org->whatsappConnection?->monthly_conversations;
        $lines = [
            "💳 *Paket tim: {$tier}*",
            '👥 Anggota: '.$org->seatsUsed().' / '.$org->memberCap(),
            '💬 Balasan bot bulan ini: '.$used.' / '.$org->botQuota().' (✅ tanpa batas)',
        ];
        if ($org->isTrialing()) {
            $lines[] = '⏳ Trial sampai '.$org->trial_ends_at->copy()->setTimezone($org->timezone())->format('j/n/Y H:i');
        }
        if (! $membership?->can('billing.manage')) {
            return implode("\n", $lines)."\n\nDetail pembayaran hanya bisa dilihat pemilik tim.";
        }
        if ($sub) {
            $lines[] = '🧾 '.WhatsAppService::rupiah(BillingService::monthlyTotal($sub)).'/bulan · '.($sub->interval === 'yearly' ? 'tahunan' : 'bulanan')
                .($sub->extra_seats ? " · +{$sub->extra_seats} kursi" : '');
            $lines[] = ($sub->cancel_at_period_end ? '⛔ Berhenti' : '🔄 Perpanjang').' pada '.$sub->current_period_end->copy()->setTimezone($org->timezone())->format('j/n/Y');
            if ($url = $org->invoices()->where('status', 'pending')->latest('id')->value('url')) {
                $lines[] = "🔗 Tagihan belum dibayar: $url";
            }
        }
        $lines[] = 'Ubah paket di menu Pengaturan → Penagihan.';

        return implode("\n", $lines);
    }

    private static function members(Organization $org): string
    {
        $roles = ['owner' => 'pemilik', 'admin' => 'admin', 'member' => 'anggota', 'viewer' => 'pengamat'];
        $ms = $org->memberships()->with('user')->get();
        $lines = ["👥 *Anggota {$org->name}*"];
        foreach ($ms->whereNotNull('user_id') as $m) {
            $lines[] = '• '.$m->user->name.' ('.($roles[$m->role] ?? $m->role).')';
        }
        if ($pending = $ms->whereNull('user_id')->count()) {
            $lines[] = "✉️ $pending undangan belum diterima";
        }

        return implode("\n", $lines);
    }

    private static function help(): string
    {
        return implode("\n", [
            '🐷 *Piggy bisa bantu:*',
            '✍️ Catat: "makan siang 25rb", "kemarin bensin 100k sama parkir 5rb", "gajian 15jt", atau kirim foto struk.',
            '📊 Tanya: "pengeluaranku minggu ini", "pengeluaran makan bulan lalu", "transaksi Salsa hari ini"',
            '🎯 "sisa anggaran" · 📋 "tagihan" · 🐷 "tabungan" · 🗂️ "kategori" · 👥 "anggota" · 💳 "paket"',
            'Transaksi yang tercatat ditandai ✅.',
        ]);
    }

    private static function range(CarbonImmutable $from, CarbonImmutable $to): string
    {
        $m = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $f = fn ($d) => $d->day.' '.$m[$d->month - 1];

        return $from->isSameDay($to) ? $f($from) : $f($from).' – '.$f($to).($from->year !== $to->year ? " {$to->year}" : '');
    }
}
