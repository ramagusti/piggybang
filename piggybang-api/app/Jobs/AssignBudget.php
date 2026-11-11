<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Services\AiClient;
use App\Services\BudgetService;
use App\Services\PaydayService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * AI picks which AI budget (UserRule::ai_assign) each expense belongs to, stored as metadata.budget (rule id, 0 = none).
 * Runs for expenses added or edited outside WhatsApp, and for the whole cycle when an AI budget changes.
 */
class AssignBudget implements ShouldQueue
{
    use Queueable;

    public const BATCH = 40;

    public int $tries = 2;

    /** @param list<int> $transactionIds */
    public function __construct(public int $organizationId, public array $transactionIds) {}

    /** Re-pick every expense of the current payday cycle, e.g. after an AI budget was added, edited or removed. */
    public static function forCycle(Organization $org): void
    {
        [$start, $end] = PaydayService::cycle($org);
        $org->transactions()->where('type', 'expense')->whereBetween('transaction_time', [$start->utc(), $end->utc()])
            ->pluck('id')->chunk(self::BATCH)->each(fn ($ids) => self::dispatch($org->id, $ids->values()->all()));
    }

    public function handle(): void
    {
        $org = Organization::find($this->organizationId);
        $rules = $org ? BudgetService::aiBudgets($org) : collect();
        if ($rules->isEmpty()) {
            return;
        }
        $txs = $org->transactions()->with('category')->whereKey($this->transactionIds)->where('type', 'expense')->get();
        // Only expenses some AI budget could take (its category/keywords) need the AI; the rest go nowhere.
        $candidates = $txs->filter(fn ($tx) => $rules->contains(fn ($r) => BudgetService::fits($r, $tx->category_id, $tx->description)));
        if ($candidates->isNotEmpty() && ! AiClient::configured()) {
            return;
        }
        $picks = $candidates->isNotEmpty() ? $this->ask($org, $rules, $candidates) : [];

        foreach ($txs as $tx) {
            $pick = $candidates->contains('id', $tx->id) ? ($picks[$tx->id] ?? null) : 0;
            if ($pick === null) {
                continue; // the AI skipped it: keep what it had
            }
            $tx->metadata = ['budget' => $rules->contains('id', $pick) ? $pick : 0] + ($tx->metadata ?? []);
            $tx->saveQuietly(); // bookkeeping, not a user edit: no audit entry or webhook
        }
    }

    /** @return array<int, int> transaction id → budget id (0 = none) */
    private function ask(Organization $org, $rules, $txs): array
    {
        $out = AiClient::json([
            ['role' => 'system', 'content' => "You file expenses of a family finance app into budgets. Reply ONLY JSON {\"picks\":[{\"id\":expense id,\"budget_id\":number|null}]}, one pick per expense.\n"
                .BudgetService::aiPrompt($rules)],
            ['role' => 'user', 'content' => json_encode($txs->map(fn ($tx) => [
                'id' => $tx->id, 'description' => $tx->description, 'category' => $tx->category?->name, 'amount' => $tx->amount.' '.$tx->currency,
                'when' => $tx->transaction_time->copy()->setTimezone($org->timezone())->toDayDateTimeString(), 'by' => $tx->actor,
            ])->values(), JSON_UNESCAPED_UNICODE)],
        ], null, 60);

        return collect($out['picks'] ?? [])->filter(fn ($p) => is_array($p) && isset($p['id']))
            ->mapWithKeys(fn ($p) => [(int) $p['id'] => (int) ($p['budget_id'] ?? 0)])->all();
    }
}
