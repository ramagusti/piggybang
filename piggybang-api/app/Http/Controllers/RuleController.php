<?php

namespace App\Http\Controllers;

use App\Http\Resources\RuleResource;
use App\Http\Resources\TransactionResource;
use App\Jobs\AssignBudget;
use App\Models\ExchangeRate;
use App\Models\Organization;
use App\Models\UserRule;
use App\Services\BudgetService;
use App\Services\Money;
use App\Services\PaydayService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RuleController extends Controller
{
    public function index(Request $request, Organization $org)
    {
        $type = $request->validate(['type' => 'nullable|in:weekly_limit,monthly_limit,payday'])['type'] ?? null;

        return RuleResource::collection($org->rules()->with('category')->when($type, fn ($q) => $q->where('type', $type))->orderBy('id')->get());
    }

    /** The expenses counting toward a budget from the start of the payday cycle until now (same matching as its progress). */
    public function transactions(Organization $org, UserRule $rule)
    {
        abort_unless(in_array($rule->type, ['weekly_limit', 'monthly_limit'], true), 404);
        [$start] = PaydayService::cycle($org);
        $txs = $org->transactions()->with('category', 'user')->where('type', 'expense')
            ->whereBetween('transaction_time', [$start->utc(), now()])->latest('transaction_time')->get()
            ->filter(fn ($tx) => BudgetService::matches($rule, $tx->category_id, $tx->description, BudgetService::budgetOf($tx->metadata)))
            ->values();

        return [
            'period_start' => $start->toIso8601String(),
            'total' => Money::fmt($txs->sum(fn ($tx) => (float) $tx->amount * ExchangeRate::rate($tx->currency, $org->currency()))),
            'transactions' => TransactionResource::collection($txs),
        ];
    }

    public function store(Request $request, Organization $org)
    {
        $rule = $org->rules()->create($this->validated($request, $org));
        $this->enforceSinglePrimary($org, $rule);
        if ($rule->ai_assign) {
            AssignBudget::forCycle($org); // the AI re-files this cycle's expenses with the new budget on its list
        }

        return (new RuleResource($rule->load('category')))->response()->setStatusCode(201);
    }

    public function update(Request $request, Organization $org, UserRule $rule)
    {
        $wasAi = $rule->ai_assign;
        $rule->update($this->validated($request, $org, $rule));
        $this->enforceSinglePrimary($org, $rule);
        if (($wasAi || $rule->ai_assign) && $rule->wasChanged(['ai_assign', 'name', 'type', 'category_id', 'category_name', 'date_condition'])) {
            AssignBudget::forCycle($org);
        }

        return new RuleResource($rule->load('category'));
    }

    public function destroy(Organization $org, UserRule $rule)
    {
        $rule->delete();
        if ($rule->ai_assign) {
            AssignBudget::forCycle($org);
        }

        return response()->noContent();
    }

    private function validated(Request $request, Organization $org, ?UserRule $rule = null): array
    {
        $req = $rule ? 'sometimes' : 'required';
        $data = $request->validate([
            'name' => "$req|string|max:100",
            'type' => "$req|in:weekly_limit,monthly_limit,payday",
            'limit_amount' => "$req|numeric|min:0",
            'category_id' => ['nullable', Rule::exists('transaction_categories', 'id')->where('organization_id', $org->id)],
            'period' => 'nullable|in:weekly,monthly',
            'is_primary_payday' => 'boolean',
            'date_condition' => ['nullable', 'regex:/^([1-9]|[12][0-9]|3[01])$/', Rule::requiredIf(fn () => $request->input('type', $rule?->type) === 'payday')],
            'category_name' => 'nullable|string|max:100',
            'rollover_enabled' => 'boolean',
            'notify' => 'boolean',
            'ai_assign' => 'boolean',
        ]);
        $type = $data['type'] ?? $rule?->type;
        if ($type !== 'payday') {
            $data['period'] = $type === 'weekly_limit' ? 'weekly' : 'monthly';
        }

        return $data;
    }

    private function enforceSinglePrimary(Organization $org, UserRule $rule): void
    {
        if ($rule->type === 'payday' && ($rule->is_primary_payday || ! $org->rules()->where('type', 'payday')->where('is_primary_payday', true)->exists())) {
            $org->rules()->where('type', 'payday')->whereKeyNot($rule->id)->update(['is_primary_payday' => false]);
            $rule->update(['is_primary_payday' => true]);
        }
    }
}
