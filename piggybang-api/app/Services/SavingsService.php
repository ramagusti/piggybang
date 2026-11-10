<?php

namespace App\Services;

use App\Models\ExchangeRate;
use App\Models\Organization;
use App\Models\Savings;

class SavingsService
{
    /** Recompute and store the cycle containing $at (default now). Called by every transaction write (afterWrite). */
    public static function recordForOrganization(Organization $org, ?\DateTimeInterface $at = null): Savings
    {
        [$start, $end] = PaydayService::cycle($org, $at);
        $totals = $org->transactions()->whereBetween('transaction_time', [$start->utc(), $end->utc()])
            ->selectRaw('type, currency, SUM(amount) as total')->groupBy('type', 'currency')->toBase()->get();
        $sum = fn (string $type) => $totals->where('type', $type)
            ->sum(fn ($r) => (float) $r->total * ExchangeRate::rate($r->currency, $org->currency()));

        $row = [
            'organization_id' => $org->id, 'cycle_start' => $start->toDateString(), 'cycle_end' => $end->toDateString(),
            'income_total' => Money::fmt($sum('income')), 'expense_total' => Money::fmt($sum('expense')), 'calculated_at' => now(),
        ];
        Savings::upsert([$row], ['organization_id', 'cycle_start'], ['cycle_end', 'income_total', 'expense_total', 'calculated_at', 'updated_at']);

        return (new Savings)->forceFill($row);
    }

    public static function present(Savings $s): array
    {
        return [
            'cycle_start' => substr($s->cycle_start, 0, 10),
            'cycle_end' => substr($s->cycle_end, 0, 10),
            'income_total' => Money::fmt($s->income_total),
            'expense_total' => Money::fmt($s->expense_total),
            'net_savings' => Money::fmt((float) $s->income_total - (float) $s->expense_total),
        ];
    }

    /**
     * Current cycle + trend. Reads the stored row (kept fresh by afterWrite on every transaction write);
     * only recomputes when the cycle has no row yet or its bounds moved (new payday, payday rule edited).
     */
    public static function current(Organization $org): array
    {
        [$start, $end] = PaydayService::cycle($org);
        $rows = $org->savings()->where('cycle_start', '<=', $start->toDateString())->orderByDesc('cycle_start')->limit(2)->get();
        $s = $rows->first();
        if (! $s || substr($s->cycle_start, 0, 10) !== $start->toDateString() || substr($s->cycle_end, 0, 10) !== $end->toDateString()) {
            $prev = $s && substr($s->cycle_start, 0, 10) !== $start->toDateString() ? $s : $rows->get(1);
            $s = self::recordForOrganization($org);
        } else {
            $prev = $rows->get(1);
        }
        $net = (float) $s->income_total - (float) $s->expense_total;
        $prevNet = $prev ? (float) $prev->income_total - (float) $prev->expense_total : null;

        return self::present($s) + [
            'previous_net' => $prev ? Money::fmt($prevNet) : null,
            'trend' => $prevNet === null || abs($net - $prevNet) < 0.01 ? 'flat' : ($net > $prevNet ? 'improving' : 'worsening'),
            'progress_pct' => (float) $s->income_total > 0 ? round((float) $s->expense_total / (float) $s->income_total * 100, 1) : 0,
        ];
    }
}
