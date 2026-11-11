<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/** Persists structured entries (from the WhatsApp bridge / AI extraction) as transactions. */
class EntryIngestionService
{
    /**
     * @param  list<array>  $entries  [{type, category:{id?,name?}, description, value:{amount,currency}, actor:{name}?, datetime, source?, confidence?}]
     * @return array{transactions: Collection, metadata: array}
     */
    public static function ingest(Organization $org, array $entries, ?User $user, string $defaultSource = 'whatsapp'): array
    {
        $categories = $org->categories()->get();
        $budgetIds = BudgetService::aiBudgets($org)->pluck('id');
        $txs = DB::transaction(fn () => collect($entries)->map(function ($e) use ($org, $user, $categories, $budgetIds, $defaultSource) {
            $cat = $categories->first(fn ($c) => $c->type === $e['type'] && isset($e['category']['id']) && $c->id === (int) $e['category']['id'])
                ?? $categories->first(fn ($c) => $c->type === $e['type'] && mb_strtolower($c->name) === mb_strtolower(trim($e['category']['name'] ?? '')))
                ?? $categories->first(fn ($c) => $c->type === $e['type'] && $c->is_system);
            $currency = strtoupper($e['value']['currency'] ?? $org->currency());
            // AI's pick among AI budgets (BudgetService::matches): an id or null (= none). Unknown id → ignored (category/keyword fallback).
            $picked = $e['type'] === 'expense' && $budgetIds->isNotEmpty() && array_key_exists('budget_id', $e)
                && ($e['budget_id'] === null || $budgetIds->contains((int) $e['budget_id']));

            return TransactionService::create($org, ($picked ? ['metadata' => ['budget' => (int) $e['budget_id']]] : []) + [
                'type' => $e['type'],
                'category_id' => $cat?->id,
                'amount' => $e['value']['amount'],
                'currency' => $org->isPro() ? $currency : $org->currency(),
                'description' => $e['description'] ?? null,
                'actor' => $e['actor']['name'] ?? $user?->name,
                'transaction_time' => Carbon::parse($e['datetime'] ?? now(), $org->timezone())->utc(),
                'confidence' => $e['confidence'] ?? null,
            ], $user, in_array($e['source'] ?? null, ['web', 'whatsapp', 'api', 'import'], true) ? $e['source'] : $defaultSource);
        }));

        return [
            'transactions' => $txs,
            'metadata' => TransactionService::afterWrite($org) + ['reminders' => ReminderService::reminders($org)],
        ];
    }

    /** Validation rules for an `output` payload (shared by HTTP ingest + AI extraction). */
    public static function rules(string $prefix = 'output.'): array
    {
        return [
            $prefix.'entries' => ['present', 'array'],
            $prefix.'entries.*.type' => ['required', 'in:income,expense'],
            $prefix.'entries.*.category' => ['required', 'array'],
            $prefix.'entries.*.category.id' => ['nullable', 'integer'],
            $prefix.'entries.*.category.name' => ['nullable', 'string', 'max:255'],
            $prefix.'entries.*.description' => ['nullable', 'string', 'max:2000'],
            $prefix.'entries.*.value.amount' => ['required', 'numeric', 'min:0'],
            $prefix.'entries.*.value.currency' => ['nullable', 'string', 'size:3'],
            $prefix.'entries.*.actor' => ['nullable', 'array'],
            $prefix.'entries.*.actor.name' => ['nullable', 'string', 'max:100'],
            $prefix.'entries.*.datetime' => ['nullable', 'date'],
            $prefix.'entries.*.source' => ['nullable', 'string', 'max:20'],
            $prefix.'entries.*.confidence' => ['nullable', 'numeric', 'between:0,1'],
            $prefix.'entries.*.budget_id' => ['nullable', 'integer'],
            $prefix.'needs_clarification' => ['sometimes', 'boolean'],
            $prefix.'clarification_question' => ['nullable', 'string'],
        ];
    }
}
