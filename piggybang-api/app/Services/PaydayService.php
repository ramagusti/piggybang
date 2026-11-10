<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\UserRule;
use App\Support\Memo;
use Carbon\CarbonImmutable;

/**
 * Payday cycle anchoring. A cycle runs from payday to the day before the next payday.
 * Nominal payday = rule.date_condition (day of month, clamped to month length).
 * If the salary actually arrived early (an income tx matching the payday category/keywords
 * within EARLY_DAYS before the nominal date), the cycle starts on that actual date.
 * No payday rule → calendar month.
 */
class PaydayService
{
    public const EARLY_DAYS = 10;

    public static function primaryRule(Organization $org): ?UserRule
    {
        return Memo::get("payday-rule:{$org->id}", fn () => $org->rules()->where('type', 'payday')->orderByDesc('is_primary_payday')->orderBy('id')->first());
    }

    /** @return array{0: CarbonImmutable, 1: CarbonImmutable} start-of-day start, end-of-day end, in org timezone */
    public static function cycle(Organization $org, ?\DateTimeInterface $at = null): array
    {
        $at = CarbonImmutable::instance($at ?? now())->setTimezone($org->timezone());

        // Day-granular (anchors are start-of-day, early-pay lookup runs to end of day), so memoize per date.
        return Memo::get("cycle:{$org->id}:{$at->toDateString()}", fn () => self::computeCycle($org, $at));
    }

    private static function computeCycle(Organization $org, CarbonImmutable $at): array
    {
        $rule = self::primaryRule($org);
        $day = (int) ($rule?->date_condition);

        if (! $rule || $day < 1 || $day > 31) {
            return [$at->startOfMonth(), $at->endOfMonth()];
        }

        $anchor = fn (CarbonImmutable $month) => $month->startOfMonth()->setDay(min($day, $month->daysInMonth))->startOfDay();
        $nominal = $at->gte($anchor($at)) ? $anchor($at) : $anchor($at->startOfMonth()->subMonth());

        $start = $nominal;
        $actual = self::latestPaydayDate($org, $rule, $nominal->subDays(self::EARLY_DAYS), $at);
        if ($actual) {
            $start = $actual->startOfDay();
        }

        $next = $anchor($start->startOfMonth()->addMonth());
        if ($next->lte($start->addDays(self::EARLY_DAYS))) { // early pay for next month's slot
            $next = $anchor($start->startOfMonth()->addMonths(2));
        }

        return [$start, $next->subDay()->endOfDay()];
    }

    /** Next nominal payday on/after $at (for reminders). */
    public static function nextPayday(Organization $org, ?\DateTimeInterface $at = null): ?CarbonImmutable
    {
        $rule = self::primaryRule($org);
        $day = (int) ($rule?->date_condition);
        if (! $rule || $day < 1 || $day > 31) {
            return null;
        }
        $at = CarbonImmutable::instance($at ?? now())->setTimezone($org->timezone())->startOfDay();
        $candidate = $at->setDay(min($day, $at->daysInMonth));

        return $candidate->gte($at) ? $candidate : $at->startOfMonth()->addMonth()->setDay(min($day, $at->startOfMonth()->addMonth()->daysInMonth));
    }

    private static function latestPaydayDate(Organization $org, UserRule $rule, CarbonImmutable $from, CarbonImmutable $to): ?CarbonImmutable
    {
        $keywords = array_filter(array_map(fn ($k) => mb_strtolower(trim($k)), explode(',', (string) $rule->category_name)));

        $tx = $org->transactions()->where('transactions.type', 'income')
            ->whereBetween('transaction_time', [$from->utc(), $to->endOfDay()->utc()])
            ->leftJoin('transaction_categories as c', 'c.id', '=', 'transactions.category_id')
            ->orderByDesc('transaction_time')->get(['transactions.transaction_time', 'transactions.category_id', 'transactions.description', 'c.name as category_label'])
            ->first(function ($tx) use ($rule, $keywords) {
                if ($rule->category_id && $tx->category_id == $rule->category_id) {
                    return true;
                }
                $haystack = mb_strtolower($tx->category_label.' '.$tx->description);
                foreach ($keywords as $k) {
                    if ($k !== '' && str_contains($haystack, $k)) {
                        return true;
                    }
                }

                return false;
            });

        return $tx ? CarbonImmutable::instance($tx->transaction_time)->setTimezone($org->timezone()) : null;
    }
}
