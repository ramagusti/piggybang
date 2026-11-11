<?php

namespace Tests\Feature;

use App\Jobs\AssignBudget;
use App\Services\BudgetService;
use App\Services\EntryIngestionService;
use App\Services\PaydayService;
use App\Services\SavingsService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
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

    public function test_payday_keywords_exclude_and_ai_payday_follows_the_pick(): void
    {
        [$owner, $org] = $this->makeOrg();
        $salary = $this->cat($org, 'Salary', 'income');
        $rule = $org->rules()->create(['name' => 'Gaji Rama', 'type' => 'payday', 'limit_amount' => 0, 'date_condition' => '26', 'is_primary_payday' => true,
            'category_id' => $salary->id, 'category_name' => '-bonus']);
        $income = fn ($desc, $date, $budget = false) => EntryIngestionService::ingest($org, [['type' => 'income', 'category' => ['id' => $salary->id],
            'description' => $desc, 'value' => ['amount' => 1000000], 'datetime' => $this->jkt($date)->toIso8601String()]
            + ($budget === false ? [] : ['budget_id' => $budget])], $owner);
        $cycleStart = fn () => PaydayService::cycle($org, $this->jkt('2026-11-25'))[0]->toDateString();

        $income('bonus tahunan', '2026-11-20 09:00');
        $this->assertSame('2026-10-26', $cycleStart()); // excluded word → not the salary

        $income('transfer kantor', '2026-11-22 09:00');
        $this->assertSame('2026-11-22', $cycleStart());

        $rule->update(['ai_assign' => true, 'category_name' => null]); // now only the AI's pick counts
        $this->assertSame('2026-10-26', $cycleStart()); // earlier income was never picked
        $income('gaji Rama', '2026-11-24 09:00', $rule->id);
        $income('THR', '2026-11-24 10:00', null);
        $this->assertSame('2026-11-24', $cycleStart());
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

    public function test_ai_budgets_follow_the_pick_inside_their_category_and_keywords(): void
    {
        [$owner, $org] = $this->makeOrg();
        $food = $this->cat($org, 'Food & Beverages');
        $rule = fn ($name, array $attrs) => $org->rules()->create($attrs + ['name' => $name, 'type' => 'monthly_limit', 'limit_amount' => 9000000]);
        $daily = $rule('Makan harian', ['type' => 'weekly_limit', 'ai_assign' => true, 'category_id' => $food->id]);
        $family = $rule('Makan besar keluarga', ['ai_assign' => true, 'category_id' => $food->id]);
        $anyAi = $rule('Jajan', ['ai_assign' => true]);                      // AI, no filter
        $foodRule = $rule('Semua makan', ['category_id' => $food->id]);      // rules only: AI pick ignored
        $total = $rule('Total', []);
        $entry = fn ($desc, $amount, $budget) => ['type' => 'expense', 'category' => ['id' => $food->id], 'description' => $desc,
            'value' => ['amount' => $amount], 'datetime' => now()->toIso8601String(), 'budget_id' => $budget];
        EntryIngestionService::ingest($org, [
            $entry('makan siang', 25000, $daily->id),
            $entry('makan malam keluarga', 450000, $family->id),
            $entry('kopi', 10000, $anyAi->id),
            $entry('roti', 1000, 999999),          // unknown id → no pick (AI unavailable in tests) → no AI budget counts it
            $entry('es teh', 5000, $foodRule->id), // not an AI budget → no pick either
        ], $owner);
        $spent = fn ($r) => BudgetService::progress($org, $r)['spent'];

        $this->assertSame('25000.00', $spent($daily));    // same category as $family, but only its own picks
        $this->assertSame('450000.00', $spent($family));
        $this->assertSame('10000.00', $spent($anyAi));
        $this->assertSame('491000.00', $spent($foodRule)); // category only: everything in it
        $this->assertSame('491000.00', $spent($total));
    }

    /** Fake AI for AssignBudget: answers each expense in the batch with $pick(expense). */
    private function fakeBudgetAi(callable $pick): void
    {
        config(['services.ai.key' => 'k', 'services.ai.base_url' => 'https://ai.test/v1']);
        Http::fake(['ai.test/*' => fn ($request) => Http::response(['choices' => [['message' => ['content' => json_encode([
            'picks' => array_map(fn ($e) => ['id' => $e['id'], 'budget_id' => $pick($e)], json_decode($request['messages'][1]['content'], true)),
        ])]]]])]);
    }

    public function test_creating_ai_budgets_lets_the_ai_file_this_cycles_expenses(): void
    {
        [$owner, $org] = $this->makeOrg();
        $health = $this->cat($org, 'Health, Selfcare & Beauty');
        foreach ([['lipstik', 150000], ['vitamin', 80000], ['sabun cuci muka', 40000]] as [$desc, $amount]) {
            $org->transactions()->create(['type' => 'expense', 'category_id' => $health->id, 'amount' => $amount, 'description' => $desc, 'transaction_time' => now()]);
        }
        $org->transactions()->create(['type' => 'expense', 'amount' => 20000, 'description' => 'parkir', 'transaction_time' => now()]); // other category
        $id = fn ($name) => $org->rules()->where('name', 'like', "$name%")->value('id');
        $picker = fn ($e) => in_array($e['description'], ['lipstik', 'sabun cuci muka'], true) ? $id('Beauty') : null;
        $this->fakeBudgetAi(function ($e) use (&$picker) {
            $this->assertNotSame('parkir', $e['description']); // no AI budget could take it → never sent to the AI

            return $picker($e);
        });
        Sanctum::actingAs($owner, ['*']);
        $create = fn ($name) => $this->postJson("/api/organizations/{$org->id}/rules", ['name' => $name, 'type' => 'monthly_limit',
            'limit_amount' => 1000000, 'category_id' => $health->id, 'ai_assign' => true])->assertCreated()->json('id');
        $spent = fn () => collect($this->getJson("/api/organizations/{$org->id}/rules")->json())->pluck('progress.spent', 'name')->all();

        $create('Beauty fund');
        $this->assertSame(['Beauty fund' => '190000.00'], $spent());

        $healthFund = $create('Health fund'); // re-files the cycle with both budgets on the list
        $picker = fn ($e) => $e['description'] === 'vitamin' ? $id('Health') : $id('Beauty');
        $this->patchJson("/api/organizations/{$org->id}/rules/{$healthFund}", ['name' => 'Health fund (vitamins)'])->assertOk();
        $this->assertSame(['Beauty fund' => '190000.00', 'Health fund (vitamins)' => '80000.00'], $spent());
    }

    public function test_excluded_keywords(): void
    {
        [$owner, $org] = $this->makeOrg();
        $transport = $this->cat($org, 'Transportation');
        $rule = fn ($words, array $attrs = []) => $org->rules()->create($attrs + ['name' => $words, 'type' => 'monthly_limit', 'limit_amount' => 1000000, 'category_name' => $words]);
        $fuel = $rule('Bensin, -ANGIN ');
        $notAir = $rule('-angin');
        $ai = $rule('-angin', ['ai_assign' => true, 'category_id' => $transport->id]);
        EntryIngestionService::ingest($org, collect([['bensin mobil', 100000], ['bensin + isi angin', 5000], ['isi angin', 10000]])
            ->map(fn ($e) => ['type' => 'expense', 'category' => ['id' => $transport->id], 'description' => $e[0], 'value' => ['amount' => $e[1]],
                'datetime' => now()->toIso8601String(), 'budget_id' => $ai->id])->all(), $owner);
        $spent = fn ($r) => BudgetService::progress($org, $r)['spent'];

        $this->assertSame('100000.00', $spent($fuel));
        $this->assertSame('100000.00', $spent($notAir)); // only exclusions: everything else counts
        $this->assertSame('100000.00', $spent($ai));     // the AI's pick can't override an exclusion
        $this->assertSame('5000.00', $spent($rule('bensin -mobil')));   // space-separated exclusion
        $this->assertSame('0.00', $spent($rule('-angin -mobil')));
    }

    public function test_ai_answer_shapes(): void
    {
        $want = [5 => 7, 6 => 0];
        $this->assertSame($want, AssignBudget::parsePicks(['picks' => [['id' => '5', 'budget_id' => 7], ['id' => 6, 'budget_id' => null]]]));
        $this->assertSame($want, AssignBudget::parsePicks([['id' => 5, 'budget_id' => '7'], ['id' => 6]]));
        $this->assertSame($want, AssignBudget::parsePicks(['5' => 7, '6' => ['budget_id' => null]]));
        $this->assertSame([], AssignBudget::parsePicks(['error' => 'rate limited']));
    }

    public function test_expense_added_in_app_gets_an_ai_budget_pick(): void
    {
        [$owner, $org] = $this->makeOrg();
        $food = $this->cat($org, 'Food & Beverages');
        $daily = $org->rules()->create(['name' => 'Makan harian', 'type' => 'weekly_limit', 'limit_amount' => 500000, 'category_id' => $food->id, 'ai_assign' => true]);
        $family = $org->rules()->create(['name' => 'Makan besar keluarga', 'type' => 'monthly_limit', 'limit_amount' => 2000000, 'category_id' => $food->id, 'ai_assign' => true]);
        $this->fakeBudgetAi(fn () => $family->id);
        Sanctum::actingAs($owner, ['*']);

        $this->postJson("/api/organizations/{$org->id}/transactions", ['type' => 'expense', 'category_id' => $food->id, 'amount' => 450000,
            'description' => 'makan malam keluarga', 'transaction_time' => now()->toIso8601String()])->assertCreated();

        $this->assertSame('0.00', BudgetService::progress($org, $daily)['spent']);
        $this->assertSame('450000.00', BudgetService::progress($org, $family)['spent']);
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
