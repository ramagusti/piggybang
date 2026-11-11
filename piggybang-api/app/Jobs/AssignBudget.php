<?php

namespace App\Jobs;

use App\Models\Transaction;
use App\Services\AiClient;
use App\Services\BudgetService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/** AI picks the budget of an expense added or edited in the app (WhatsApp entries get theirs during extraction). */
class AssignBudget implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public function __construct(public int $transactionId) {}

    public function handle(): void
    {
        $tx = Transaction::with('organization', 'category')->find($this->transactionId);
        $rules = $tx?->type === 'expense' ? BudgetService::aiBudgets($tx->organization) : collect();
        if ($rules->isEmpty() || ! AiClient::configured()) {
            return;
        }
        $org = $tx->organization;
        $out = AiClient::json([
            ['role' => 'system', 'content' => "You file one expense of a family finance app into a budget. Reply ONLY JSON {\"budget_id\":number|null}.\n".BudgetService::aiPrompt($rules)],
            ['role' => 'user', 'content' => json_encode([
                'description' => $tx->description, 'category' => $tx->category?->name, 'amount' => $tx->amount.' '.$tx->currency,
                'when' => $tx->transaction_time->copy()->setTimezone($org->timezone())->toDayDateTimeString(), 'by' => $tx->actor,
            ], JSON_UNESCAPED_UNICODE)],
        ]);
        $id = $out['budget_id'] ?? null;
        $meta = $tx->metadata ?? [];
        unset($meta['budget']); // unknown id → no pick (category/keyword fallback)
        if ($id === null || $rules->contains('id', (int) $id)) {
            $meta['budget'] = (int) $id;
        }
        $tx->metadata = $meta;
        $tx->saveQuietly(); // bookkeeping, not a user edit: no audit entry or webhook
    }
}
