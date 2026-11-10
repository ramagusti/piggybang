<?php

namespace Tests\Feature;

use App\Services\BudgetService;
use App\Services\PaydayService;
use App\Services\SavingsService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PaydayBudgetTest extends TestCase
{
    use RefreshDatabase;

    private function jkt(string $s): CarbonImmutable
    {
        return CarbonImmutable::parse($s, 'Asia/Jakarta');
    }

    public function test_cycle_is_calendar_month_without_payday_rule(): void
    {
        [, $org] = $this->makeOrg();
        [$s, $e] = PaydayService::cycle($org, $this->jkt('2026-11-10 12:00'));
        $this->assertSame(['2026-11-01', '2026-11-30'], [$s->toDateString(), $e->toDateString()]);
    }

    public function test_cycle_anchors_on_payday_and_moves_with_early_salary(): void
    {
        [, $org] = $this->makeOrg();
        $salary = $this->cat($org, 'Salary', 'income');
        $org->rules()->create(['name' => 'Gajian', 'type' => 'payday', 'limit_amount' => 4500000, 'date_condition' => '26', 'is_primary_payday' => true, 'category_id' => $salary->id]);

        [$s, $e] = PaydayService::cycle($org, $this->jkt('2026-11-10'));
        $this->assertSame(['2026-10-26', '2026-11-25'], [$s->toDateString(), $e->toDateString()]);

        $org->transactions()->create(['type' => 'income', 'amount' => 4500000, 'category_id' => $salary->id, 'transaction_time' => $this->jkt('2026-11-24 09:00')->utc()]);
        [$s, $e] = PaydayService::cycle($org, $this->jkt('2026-11-25'));
        $this->assertSame(['2026-11-24', '2026-12-25'], [$s->toDateString(), $e->toDateString()]);
    }

    public function test_memoized_reads_refresh_after_writes_in_same_app(): void
    {
        [$owner, $org] = $this->makeOrg();
        $food = $this->cat($org, 'Food & Beverages');
        $rule = $org->rules()->create(['name' => 'Makan', 'type' => 'monthly_limit', 'limit_amount' => 100000, 'category_id' => $food->id]);
        Sanctum::actingAs($owner, ['*']);
        $spent = fn () => $this->getJson("/api/organizations/{$org->id}/rules?type=monthly_limit")->json('0.progress.spent');

        $this->assertSame('0.00', $spent());
        $this->postJson("/api/organizations/{$org->id}/transactions", ['type' => 'expense', 'category_id' => $food->id, 'amount' => 25000, 'description' => 'Makan siang', 'transaction_time' => now()->toIso8601String()])->assertCreated();
        $this->assertSame('25000.00', $spent());
        $this->assertSame('25000.00', $this->getJson("/api/organizations/{$org->id}/savings")->json('expense_total'));

        $rule->update(['category_id' => null, 'category_name' => 'tidak ada']);
        $this->assertSame('0.00', $spent());
        $rule->update(['category_name' => 'tidak ada, MAKAN ']); // comma list, case/space-insensitive
        $this->assertSame('25000.00', $spent());
    }

    public function test_payday_31_clamps_to_short_months(): void
    {
        [, $org] = $this->makeOrg();
        $org->rules()->create(['name' => 'Gajian', 'type' => 'payday', 'limit_amount' => 0, 'date_condition' => '31', 'is_primary_payday' => true]);
        [$s, $e] = PaydayService::cycle($org, $this->jkt('2027-03-05'));
        $this->assertSame(['2027-02-28', '2027-03-30'], [$s->toDateString(), $e->toDateString()]);
    }

    public function test_weekly_budget_signed_rollover_is_pro_only(): void
    {
        [, $org] = $this->makeOrg('pro');
        $food = $this->cat($org, 'Food & Beverages');
        $rule = $org->rules()->create(['name' => 'Daily meals', 'type' => 'weekly_limit', 'limit_amount' => 500000, 'category_id' => $food->id, 'rollover_enabled' => true]);
        foreach ([['2026-11-01 12:00', 100000], ['2026-11-03 12:00', 700000], ['2026-11-10 08:00', 50000]] as [$t, $amt]) {
            $org->transactions()->create(['type' => 'expense', 'amount' => $amt, 'category_id' => $food->id, 'transaction_time' => $this->jkt($t)->utc()]);
        }
        // Nov 2026 starts on a Sunday: prior weeks = [Nov 1], [Nov 2–8] → carryover 2×500k − 800k = 200k
        $p = BudgetService::progress($org, $rule, $this->jkt('2026-11-10 12:00'));
        $this->assertSame(['200000.00', '700000.00', '50000.00', '650000.00'], [$p['carryover'], $p['effective_limit'], $p['spent'], $p['remaining']]);

        // Week of Nov 2–8 alone: 700k spent vs 500k + (500k − 100k) = 900k
        $this->assertSame([], BudgetService::warnings($org, $this->jkt('2026-11-04'))); // 700k/900k = 78% < 80%

        $org->update(['plan' => 'free']);
        $p = BudgetService::progress($org->fresh(), $rule, $this->jkt('2026-11-10 12:00'));
        $this->assertSame(['0.00', '500000.00'], [$p['carryover'], $p['effective_limit']]);
    }

    public function test_savings_records_cycle_totals(): void
    {
        [, $org] = $this->makeOrg();
        $this->travelTo($this->jkt('2026-11-15 10:00'));
        $org->transactions()->create(['type' => 'income', 'amount' => 1000, 'transaction_time' => now()]);
        $org->transactions()->create(['type' => 'expense', 'amount' => 1500.5, 'transaction_time' => now()]);
        $org->transactions()->create(['type' => 'expense', 'amount' => 999, 'transaction_time' => now()->subMonth()]); // other cycle
        SavingsService::current($org);
        $s = SavingsService::current($org); // recalculation must update, not insert
        $this->assertSame(1, $org->savings()->count());
        $this->assertSame(['1000.00', '1500.50', '-500.50'], [$s['income_total'], $s['expense_total'], $s['net_savings']]);
    }
}
