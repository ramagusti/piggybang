<?php

namespace App\Http\Controllers;

use App\Http\Resources\RuleResource;
use App\Models\Organization;
use App\Models\UserRule;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RuleController extends Controller
{
    public function index(Request $request, Organization $org)
    {
        $type = $request->validate(['type' => 'nullable|in:weekly_limit,monthly_limit,payday'])['type'] ?? null;

        return RuleResource::collection($org->rules()->with('category')->when($type, fn ($q) => $q->where('type', $type))->orderBy('id')->get());
    }

    public function store(Request $request, Organization $org)
    {
        $rule = $org->rules()->create($this->validated($request, $org));
        $this->enforceSinglePrimary($org, $rule);

        return (new RuleResource($rule->load('category')))->response()->setStatusCode(201);
    }

    public function update(Request $request, Organization $org, UserRule $rule)
    {
        $rule->update($this->validated($request, $org, $rule));
        $this->enforceSinglePrimary($org, $rule);

        return new RuleResource($rule->load('category'));
    }

    public function destroy(Organization $org, UserRule $rule)
    {
        $rule->delete();

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
