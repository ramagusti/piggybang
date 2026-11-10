<?php

namespace App\Http\Controllers;

use App\Http\Resources\BillResource;
use App\Http\Resources\OrganizationResource;
use App\Http\Resources\TransactionResource;
use App\Models\ExchangeRate;
use App\Models\Organization;
use App\Services\BudgetService;
use App\Services\Money;
use App\Services\OrganizationService;
use App\Services\SavingsService;
use App\Support\Jwt;
use App\Support\SafeUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OrganizationController extends Controller
{
    public function index(Request $request)
    {
        return OrganizationResource::collection($request->user()->memberships()->with('organization')->get()->pluck('organization'));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'slug' => ['nullable', 'string', 'max:100', 'regex:/^[a-z0-9](-?[a-z0-9])*$/', 'unique:organizations,slug', Rule::notIn(OrganizationService::RESERVED)],
        ]);

        return (new OrganizationResource(OrganizationService::create($request->user(), $data['name'], $data['slug'] ?? null)))->response()->setStatusCode(201);
    }

    public function show(Organization $org)
    {
        return new OrganizationResource($org);
    }

    public function update(Request $request, Organization $org)
    {
        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'slug' => ['sometimes', 'string', 'max:100', 'regex:/^[a-z0-9](-?[a-z0-9])*$/', Rule::unique('organizations', 'slug')->ignore($org->id), Rule::notIn(OrganizationService::RESERVED)],
            'settings' => 'sometimes|array',
            'settings.timezone' => 'sometimes|timezone:all',
            'settings.currency' => 'sometimes|string|size:3',
            'settings.date_format' => 'sometimes|string|max:20',
            'settings.onboarded' => 'sometimes|boolean',
            'settings.webhook_url' => 'sometimes|nullable|url:https|max:500',
        ]);
        $settings = array_intersect_key($data['settings'] ?? [], array_flip(['timezone', 'currency', 'date_format', 'onboarded', 'webhook_url']));
        if (isset($settings['currency']) && $settings['currency'] !== 'IDR' && ! $org->isPro()) {
            throw OrganizationService::planLimit('Multi-mata uang hanya untuk Pro.');
        }
        if (! empty($settings['webhook_url'])) {
            if (! $org->isPro()) {
                throw OrganizationService::planLimit('Webhook hanya untuk Pro.');
            }
            if (! SafeUrl::isPublicHttps($settings['webhook_url'])) {
                throw ValidationException::withMessages(['settings.webhook_url' => ['URL webhook harus https dan publik.']]);
            }
            $settings['webhook_secret'] = $org->settings['webhook_secret'] ?? Str::random(40);
        }
        $org->update(array_filter([
            'name' => $data['name'] ?? null,
            'slug' => $data['slug'] ?? null,
        ]) + ['settings' => array_merge($org->settings ?? [], $settings)]);

        return new OrganizationResource($org->fresh());
    }

    public function destroy(Organization $org)
    {
        if ($org->subscriptions()->where('status', 'active')->where('cancel_at_period_end', false)->exists()) {
            return response()->json(['message' => 'Batalkan langganan dulu sebelum menghapus organisasi.'], 422);
        }
        $org->delete();

        return response()->noContent();
    }

    public function switch(Request $request, Organization $org)
    {
        $request->user()->update(['current_organization_id' => $org->id]);

        return response()->noContent();
    }

    public function onboarding(Request $request, Organization $org)
    {
        $data = $request->validate([
            'categories' => 'sometimes|array',
            'categories.*.type' => 'required|in:income,expense',
            'categories.*.name' => 'required|string|max:100',
            'budgets' => 'sometimes|array',
            'budgets.*.name' => 'required|string|max:100',
            'budgets.*.category_id' => ['nullable', Rule::exists('transaction_categories', 'id')->where('organization_id', $org->id)],
            'budgets.*.limit_amount' => 'required|numeric|min:0',
            'payday_day' => 'nullable|integer|between:1,31',
        ]);
        foreach ($data['categories'] ?? [] as $c) {
            if (! $org->categories()->where($c)->exists()) {
                OrganizationService::assertCategoryAvailable($org, $c['type']);
                $org->categories()->create($c + ['sort_order' => $org->categories()->where('type', $c['type'])->max('sort_order') + 1]);
            }
        }
        foreach ($data['budgets'] ?? [] as $b) {
            $org->rules()->create($b + ['type' => 'weekly_limit', 'period' => 'weekly', 'rollover_enabled' => true]);
        }
        if (! empty($data['payday_day'])) {
            $salary = $org->categories()->where('type', 'income')->where('name', 'Salary')->first();
            $org->rules()->updateOrCreate(['type' => 'payday', 'is_primary_payday' => true], [
                'name' => 'Gajian', 'limit_amount' => 0, 'date_condition' => (string) $data['payday_day'],
                'category_id' => $salary?->id, 'category_name' => 'gajian, salary, gaji',
            ]);
        }
        $org->update(['settings' => array_merge($org->settings ?? [], ['onboarded' => true])]);

        return new OrganizationResource($org->fresh());
    }

    public function dashboard(Request $request, Organization $org)
    {
        $period = $request->validate(['period' => 'nullable|in:week,month,year'])['period'] ?? 'month';
        $now = now($org->timezone());
        [$from, $to] = match ($period) {
            'week' => [$now->copy()->startOfWeek(), $now->copy()->endOfWeek()],
            'year' => [$now->copy()->startOfYear(), $now->copy()->endOfYear()],
            default => [$now->copy()->startOfMonth(), $now->copy()->endOfMonth()],
        };
        $prevFrom = match ($period) {
            'week' => $from->copy()->subWeek(), 'year' => $from->copy()->subYear(), default => $from->copy()->subMonthNoOverflow(),
        };
        $cur = $org->currency();
        // One pass over [prevFrom, to]: totals per type × currency × (current | previous period).
        $totals = $org->transactions()->whereBetween('transaction_time', [$prevFrom->copy()->utc(), $to->copy()->utc()])
            ->selectRaw('type, currency, CASE WHEN transaction_time >= ? THEN 1 ELSE 0 END AS cur, SUM(amount) AS total', [$from->copy()->utc()])
            ->groupByRaw('type, currency, 3')->toBase()->get();
        $sum = fn ($type, $isCur) => $totals->where('type', $type)->where('cur', $isCur)
            ->sum(fn ($r) => (float) $r->total * ExchangeRate::rate($r->currency, $cur));
        [$income, $expense, $prevIncome, $prevExpense] = [$sum('income', 1), $sum('expense', 1), $sum('income', 0), $sum('expense', 0)];
        $pct = fn ($now, $prev) => $prev > 0 ? round(($now - $prev) / $prev * 100, 1) : null;
        $savings = SavingsService::current($org);

        $byCategory = $org->transactions()->where('transactions.type', 'expense')
            ->whereBetween('transaction_time', [$from->copy()->utc(), $to->copy()->utc()])
            ->leftJoin('transaction_categories as c', 'c.id', '=', 'transactions.category_id')
            ->selectRaw('transactions.category_id, c.name, c.color, SUM(transactions.amount) as total')
            ->groupBy('transactions.category_id', 'c.name', 'c.color')->orderByDesc('total')->get()
            ->map(fn ($r) => ['category_id' => $r->category_id, 'name' => $r->name ?? 'Tanpa kategori', 'color' => $r->color, 'total' => Money::fmt($r->total)]);

        return [
            'kpi' => [
                'savings' => $savings['net_savings'], 'income' => Money::fmt($income), 'expense' => Money::fmt($expense),
                'income_change_pct' => $pct($income, $prevIncome), 'expense_change_pct' => $pct($expense, $prevExpense),
                'savings_progress_pct' => $savings['progress_pct'],
            ],
            'recent_transactions' => TransactionResource::collection($org->transactions()->with('category', 'user')->latest('transaction_time')->limit(5)->get()),
            'budget_warnings' => BudgetService::warnings($org),
            'upcoming_bills' => BillResource::collection($org->bills()->where('is_active', true)->orderBy('due_date')->limit(5)->get()),
            'expense_by_category' => $byCategory,
            'transactions_total' => $org->transactions()->count(),
        ];
    }

    /** Short-lived Supabase JWT carrying org_id for RLS-filtered Realtime subscriptions. */
    public function realtimeToken(Request $request, Organization $org)
    {
        $secret = config('services.supabase.jwt_secret');
        if (! $secret || ! config('services.supabase.url')) {
            return response()->noContent();
        }
        $exp = now()->addHour();

        return [
            'url' => config('services.supabase.url'),
            'anon_key' => config('services.supabase.anon_key'),
            'schema' => config('database.connections.pgsql.search_path'),
            'token' => Jwt::encode([
                'role' => 'authenticated', 'sub' => (string) $request->user()->id, 'org_id' => $org->id,
                'iat' => now()->timestamp, 'exp' => $exp->timestamp,
            ], $secret),
            'expires_at' => $exp->toIso8601String(),
        ];
    }
}
