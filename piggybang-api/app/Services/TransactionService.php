<?php

namespace App\Services;

use App\Http\Resources\TransactionResource;
use App\Jobs\SendOrganizationWebhook;
use App\Models\Organization;
use App\Models\Transaction;
use App\Models\User;

class TransactionService
{
    public static function create(Organization $org, array $data, ?User $user, string $source = 'web'): Transaction
    {
        $tx = $org->transactions()->create($data + [
            'user_id' => $user?->id,
            'source' => $source,
            'currency' => $data['currency'] ?? $org->currency(),
            'actor' => $data['actor'] ?? $user?->name,
        ]);
        self::fireWebhook($org, 'transaction.created', $tx);

        return $tx->load('category', 'user');
    }

    /** Post-write bookkeeping shared by create/update/delete/import/ingest. */
    public static function afterWrite(Organization $org): array
    {
        return [
            'budget_warnings' => BudgetService::warnings($org),
            'savings' => SavingsService::present(SavingsService::recordForOrganization($org)),
        ];
    }

    public static function fireWebhook(Organization $org, string $event, Transaction $tx): void
    {
        if ($org->isPro() && ! empty($org->settings['webhook_url'])) {
            SendOrganizationWebhook::dispatch($org->id, $event, (new TransactionResource($tx->load('category', 'user')))->resolve());
        }
    }
}
