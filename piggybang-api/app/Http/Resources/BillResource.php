<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class BillResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'name' => $this->name, 'amount' => $this->amount, 'currency' => $this->currency,
            'due_date' => $this->due_date->toDateString(), 'recurrence' => $this->recurrence, 'category_id' => $this->category_id,
            'destination_account' => $this->destination_account, 'destination_number' => $this->destination_number,
            'is_active' => $this->is_active, 'last_paid_at' => $this->last_paid_at?->toIso8601String(),
            'category' => $this->category?->only(['id', 'name', 'icon', 'color']), 'created_by' => $this->creator?->only(['id', 'name']),
            'days_until_due' => $this->daysUntilDue(), 'status' => $this->status(),
        ];
    }
}
