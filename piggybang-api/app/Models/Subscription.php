<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    use Auditable;

    protected $guarded = [];

    protected $casts = [
        'current_period_start' => 'datetime', 'current_period_end' => 'datetime', 'trial_ends_at' => 'datetime',
        'cancel_at_period_end' => 'boolean', 'metadata' => 'array',
    ];

    protected $attributes = ['metadata' => '{}'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
