<?php

namespace App\Services;

use App\Models\Organization;

class ReminderService
{
    /** Bills due within $days (incl. overdue) + upcoming primary payday. */
    public static function reminders(Organization $org, int $days = 3): array
    {
        $out = [];
        $today = now($org->timezone())->startOfDay();
        foreach ($org->bills()->where('is_active', true)->whereDate('due_date', '<=', $today->copy()->addDays($days))->orderBy('due_date')->get() as $bill) {
            $out[] = ['kind' => 'bill', 'name' => $bill->name, 'amount' => Money::fmt($bill->amount), 'days_until' => $bill->daysUntilDue(), 'date' => $bill->due_date->toDateString()];
        }
        $payday = PaydayService::nextPayday($org);
        if ($payday && ($until = (int) $today->diffInDays($payday, false)) <= $days) {
            $rule = PaydayService::primaryRule($org);
            $out[] = ['kind' => 'payday', 'name' => $rule->name, 'amount' => Money::fmt($rule->limit_amount), 'days_until' => $until, 'date' => $payday->toDateString()];
        }

        return $out;
    }
}
