<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;

class Bill extends Model
{
    use Auditable;

    protected $guarded = [];

    protected $casts = [
        'due_date' => 'date', 'amount' => 'decimal:2', 'is_active' => 'boolean',
        'last_paid_at' => 'datetime', 'last_notified_at' => 'datetime',
    ];

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
