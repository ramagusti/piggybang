<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Transaction extends Model
{
    use Auditable, SoftDeletes;

    protected $guarded = [];

    protected $casts = ['transaction_time' => 'datetime', 'metadata' => 'array', 'amount' => 'decimal:2', 'confidence' => 'decimal:2'];

    protected $attributes = ['metadata' => '{}'];

    public function category(): BelongsTo
    {
        return $this->belongsTo(TransactionCategory::class, 'category_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
