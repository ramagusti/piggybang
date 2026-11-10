<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['old_values' => 'array', 'new_values' => 'array'];
}
