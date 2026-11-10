<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class CategoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id, 'type' => $this->type, 'name' => $this->name, 'icon' => $this->icon, 'color' => $this->color,
            'sort_order' => $this->sort_order, 'is_system' => $this->is_system,
            'transactions_count' => $this->transactions_count ?? $this->transactions()->count(),
        ];
    }
}
