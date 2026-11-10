<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Savings extends Model
{
    protected $table = 'savings';

    protected $guarded = ['net_savings'];

    protected $casts = [
        // cycle_start/cycle_end stay plain 'Y-m-d' strings: a date cast stores 'Y-m-d H:i:s' on sqlite and breaks updateOrCreate lookups.
        'calculated_at' => 'datetime',
        'income_total' => 'decimal:2', 'expense_total' => 'decimal:2', 'net_savings' => 'decimal:2',
    ];
}
