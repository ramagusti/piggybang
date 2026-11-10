<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppSender extends Model
{
    protected $table = 'whatsapp_senders';

    protected $guarded = [];

    protected $casts = ['last_message_at' => 'datetime'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
