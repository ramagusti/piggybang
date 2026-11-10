<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class TransactionResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'type' => $this->type, 'amount' => $this->amount, 'currency' => $this->currency,
            'description' => $this->description, 'actor' => $this->actor,
            'transaction_time' => $this->transaction_time?->toIso8601String(),
            'category' => $this->category ? $this->category->only(['id', 'name', 'icon', 'color']) : null,
            'user' => $this->user ? $this->user->only(['id', 'name']) : null,
            'proof_url' => $this->proof_url, 'source' => $this->source,
            'split' => $this->metadata['split'] ?? null, // {group, part, of, total} when created by split bill
            'confidence' => $this->confidence !== null ? (float) $this->confidence : null,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
