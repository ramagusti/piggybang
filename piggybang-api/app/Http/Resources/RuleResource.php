<?php

namespace App\Http\Resources;

use App\Services\BudgetService;
use App\Services\PaydayService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class RuleResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $org = $request->route('org');
        $data = [
            'id' => $this->id, 'name' => $this->name, 'type' => $this->type, 'category_id' => $this->category_id,
            'category' => $this->category ? $this->category->only(['id', 'name', 'icon', 'color']) : null,
            'limit_amount' => $this->limit_amount, 'period' => $this->period, 'is_primary_payday' => $this->is_primary_payday,
            'date_condition' => $this->date_condition, 'category_name' => $this->category_name, 'rollover_enabled' => $this->rollover_enabled,
            'notify' => (bool) ($this->notify ?? true), 'ai_assign' => (bool) $this->ai_assign,
        ];
        if ($this->type === 'payday') {
            [$s, $e] = PaydayService::cycle($org);
            $data['cycle'] = ['start' => $s->toDateString(), 'end' => $e->toDateString()];
        } else {
            $data['progress'] = BudgetService::progress($org, $this->resource);
        }

        return $data;
    }
}
