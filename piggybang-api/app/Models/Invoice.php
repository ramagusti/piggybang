<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Invoice extends Model
{
    protected $guarded = [];

    protected $casts = ['paid_at' => 'datetime', 'metadata' => 'array'];

    protected $attributes = ['metadata' => '{}'];
}
