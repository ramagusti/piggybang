<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use App\Services\AiClient;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Bill extends Model
{
    use Auditable;

    protected $guarded = [];

    protected $casts = [
        'due_date' => 'date', 'amount' => 'decimal:2', 'is_active' => 'boolean',
        'last_paid_at' => 'datetime', 'last_notified_at' => 'datetime',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class, 'category_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Expense category for a bill saved without one, from its name ("Listrik PLN", "Cicilan motor", "SPP Dara").
     * AI picks from the team's own categories; without AI (or if it fails) falls back to the bills-like category.
     */
    public static function guessCategoryId(Organization $org, string $name): ?int
    {
        $cats = $org->categories()->where('type', 'expense')->orderBy('sort_order')->get(['id', 'name']);
        if (AiClient::configured() && $cats->isNotEmpty()) {
            try {
                $id = AiClient::json([
                    ['role' => 'system', 'content' => 'Pick the expense category that best fits a recurring household bill. Reply JSON {"id": number} using an id from the list.'],
                    ['role' => 'user', 'content' => 'Bill: '.$name."\nCategories: ".$cats->toJson()],
                ], timeout: 8)['id'] ?? null;
                if ($cats->contains('id', (int) $id)) {
                    return (int) $id;
                }
            } catch (\Throwable) {
                // saving the bill matters more than the guess
            }
        }

        return $cats->first(fn ($c) => preg_match('/bill|tagihan|subscri|langganan|utilit/i', $c->name))?->id;
    }

    public function daysUntilDue(): int
    {
        return (int) now()->startOfDay()->diffInDays($this->due_date->copy()->startOfDay(), false);
    }

    public function status(): string
    {
        if (! $this->is_active) {
            return 'paid';
        }
        $d = $this->daysUntilDue();

        return match (true) {
            $d < 0 => 'overdue',
            $d <= 3 => 'due_soon',
            $d <= 7 => 'upcoming',
            default => 'normal',
        };
    }

    /** Next due date after paying, or null for one-time bills. */
    public function nextDueDate(): ?Carbon
    {
        return match ($this->recurrence) {
            'monthly' => $this->due_date->copy()->addMonthNoOverflow(),
            'quarterly' => $this->due_date->copy()->addMonthsNoOverflow(3),
            'yearly' => $this->due_date->copy()->addYear(),
            default => null,
        };
    }
}
