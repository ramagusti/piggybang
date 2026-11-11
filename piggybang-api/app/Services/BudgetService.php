<?php

namespace App\Services;

use App\Models\ExchangeRate;
use App\Models\Organization;
use App\Models\UserRule;
use App\Support\Memo;
use Carbon\CarbonImmutable;

/**
 * Budget progress. Weekly limits use Monday-start weeks clipped to the payday cycle, with signed
 * rollover inside the cycle: effective = limit + Σ(prior weeks: limit − spent). Resets each cycle.
 * Monthly limits apply to the whole payday cycle.
 */
class BudgetService
{
    public static function progress(Organization $org, UserRule $rule, ?\DateTimeInterface $at = null): ?array
    {
        if (! in_array($rule->type, ['weekly_limit', 'monthly_limit'], true)) {
            return null;
        }
        $at = CarbonImmutable::instance($at ?? now())->setTimezone($org->timezone());
        [$cycleStart, $cycleEnd] = PaydayService::cycle($org, $at);
        $limit = (float) $rule->limit_amount;

        if ($rule->type === 'monthly_limit') {
            $spent = self::spent($org, $rule, $cycleStart, $cycleEnd, $cycleStart, $cycleEnd);

            return self::shape($cycleStart, $cycleEnd, $spent, $limit, 0);
        }

        $weekStart = max($cycleStart, $at->startOfWeek(CarbonImmutable::MONDAY));
        $weekEnd = min($cycleEnd, $at->endOfWeek(CarbonImmutable::SUNDAY));
        $carryover = 0.0;
        if ($rule->rollover_enabled && $org->isPro() && $weekStart->gt($cycleStart)) { // rollover = Pro (advanced budgets)
            $priorWeeks = 0;
            for ($w = $cycleStart; $w->lt($weekStart); $w = $w->startOfWeek(CarbonImmutable::MONDAY)->addWeek()) {
                $priorWeeks++;
            }
            $carryover = $priorWeeks * $limit - self::spent($org, $rule, $cycleStart, $weekStart->subSecond(), $cycleStart, $cycleEnd);
        }

        return self::shape($weekStart, $weekEnd, self::spent($org, $rule, $weekStart, $weekEnd, $cycleStart, $cycleEnd), $limit, $carryover);
    }

    /** @return list<array> warnings for limit rules ≥80% used */
    public static function warnings(Organization $org, ?\DateTimeInterface $at = null): array
    {
        $out = [];
        foreach ($org->rules()->whereIn('type', ['weekly_limit', 'monthly_limit'])->get() as $rule) {
            $p = self::progress($org, $rule, $at);
            if ($p['percent'] >= 80) {
                $out[] = [
                    'rule_id' => $rule->id, 'name' => $rule->name, 'period_start' => $p['period_start'], 'period' => $rule->type === 'weekly_limit' ? 'weekly' : 'monthly',
                    'spent' => $p['spent'], 'effective_limit' => $p['effective_limit'], 'base_limit' => $p['base_limit'],
                    'remaining' => $p['remaining'], 'percent' => $p['percent'],
                    'level' => $p['percent'] > 100 ? 'exceeded' : 'near',
                ];
            }
        }

        return $out;
    }

    /** Spend for $rule in [$from, $to] (always inside the cycle), from the cycle's expenses loaded once per request. */
    private static function spent(Organization $org, UserRule $rule, CarbonImmutable $from, CarbonImmutable $to, CarbonImmutable $cycleStart, CarbonImmutable $cycleEnd): float
    {
        [$f, $t] = [$from->timestamp, $to->timestamp];

        return self::cycleExpenses($org, $cycleStart, $cycleEnd)
            ->filter(fn ($e) => $e['at'] >= $f && $e['at'] <= $t && self::matches($rule, $e['category_id'], $e['description'], $e['budget']))
            ->sum('amount');
    }

    /**
     * Does an expense count toward $rule? It must fit the rule's category and keywords, and for an AI budget (ai_assign)
     * the AI must also have picked this rule for it ($budget: rule id; 0/null = none or not picked yet, see AssignBudget).
     */
    public static function matches(UserRule $rule, ?int $categoryId, ?string $description, ?int $budget = null): bool
    {
        return self::fits($rule, $categoryId, $description) && (! $rule->ai_assign || $budget === $rule->id);
    }

    /**
     * Category (if set) and comma-separated keywords: any keyword in the description, none of the "-excluded" ones
     * ("bensin, pertalite, -angin"). Nothing set → every expense.
     */
    public static function fits(UserRule $rule, ?int $categoryId, ?string $description): bool
    {
        [$include, $exclude] = self::keywords($rule);
        $description = mb_strtolower((string) $description);
        $has = fn (array $words) => (bool) array_filter($words, fn ($k) => str_contains($description, $k));

        return (! $rule->category_id || $categoryId == $rule->category_id) && (! $include || $has($include)) && ! $has($exclude);
    }

    /** @return array{0: list<string>, 1: list<string>} [keywords, excluded keywords] */
    private static function keywords(UserRule $rule): array
    {
        $words = array_filter(array_map(fn ($k) => trim(mb_strtolower($k)), explode(',', (string) $rule->category_name)));
        $excluded = array_filter($words, fn ($k) => str_starts_with($k, '-'));

        return [
            array_values(array_diff($words, $excluded)),
            array_values(array_filter(array_map(fn ($k) => trim(substr($k, 1)), $excluded))),
        ];
    }

    /** Budgets the AI files expenses into. */
    public static function aiBudgets(Organization $org)
    {
        return $org->rules()->whereIn('type', ['weekly_limit', 'monthly_limit'])->where('ai_assign', true)->with('category')->orderBy('id')->get();
    }

    /** Prompt section asking for `budget_id`; shared by WhatsApp extraction and AssignBudget. */
    public static function aiPrompt($rules): string
    {
        $lines = $rules->map(function ($r) {
            [$include, $exclude] = self::keywords($r);

            return "{$r->id}|".($r->type === 'weekly_limit' ? 'weekly' : 'monthly')."|{$r->name}|".($r->category?->name ?? 'any')
                .'|'.(implode(', ', $include) ?: 'any').'|'.(implode(', ', $exclude) ?: '-');
        })->implode("\n");

        return <<<PROMPT
BUDGETS (id|period|name|only category|only if description contains one of|never if description contains one of):
{$lines}
budget_id (expenses only): the ONE budget from BUDGETS this expense belongs to, judged by what it is and the occasion; the name says the budget's purpose. A budget only takes expenses that fit its category and words, when those are set. E.g. with "Makan harian" and "Makan besar keluarga": "makan siang 25rb" → Makan harian, "makan malam sama keluarga di resto 450rb" → Makan besar keluarga. null when none fits.
PROMPT;
    }

    /** The AI's budget pick stored on a transaction: rule id, 0 = none, null = not picked (match by category/keywords). */
    public static function budgetOf(?array $metadata): ?int
    {
        return isset($metadata['budget']) ? (int) $metadata['budget'] : null;
    }

    private static function cycleExpenses(Organization $org, CarbonImmutable $start, CarbonImmutable $end)
    {
        return Memo::get("cycle-expenses:{$org->id}:{$start->timestamp}:{$end->timestamp}", fn () => $org->transactions()
            ->where('type', 'expense')->whereBetween('transaction_time', [$start->utc(), $end->utc()])
            ->toBase()->get(['transaction_time', 'category_id', 'description', 'amount', 'currency', 'metadata'])
            ->map(fn ($r) => [
                'at' => CarbonImmutable::parse($r->transaction_time, 'UTC')->timestamp,
                'category_id' => $r->category_id,
                'description' => mb_strtolower((string) $r->description),
                'budget' => self::budgetOf(json_decode((string) $r->metadata, true) ?: []),
                'amount' => (float) $r->amount * ExchangeRate::rate($r->currency, $org->currency()),
            ]));
    }

    private static function shape(CarbonImmutable $start, CarbonImmutable $end, float $spent, float $limit, float $carryover): array
    {
        // Signed rollover can push the allowance below zero after big overspends; floor it at 0 (still shows as "over").
        $effective = max(0, $limit + $carryover);
        $percent = $effective > 0 ? $spent / $effective * 100 : ($spent > 0 ? 999 : 0);

        return [
            'period_start' => $start->toIso8601String(), 'period_end' => $end->toIso8601String(),
            'spent' => Money::fmt($spent), 'base_limit' => Money::fmt($limit), 'carryover' => Money::fmt($carryover),
            'effective_limit' => Money::fmt($effective), 'remaining' => Money::fmt($effective - $spent),
            'percent' => round($percent, 1),
        ];
    }
}
