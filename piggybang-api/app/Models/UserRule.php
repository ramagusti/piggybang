<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserRule extends Model
{
    use Auditable;

    protected $guarded = [];

    protected $casts = ['limit_amount' => 'decimal:2', 'is_primary_payday' => 'boolean', 'rollover_enabled' => 'boolean', 'notify' => 'boolean'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class, 'category_id');
    }
}
