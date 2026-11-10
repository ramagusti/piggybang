<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WhatsAppConnection extends Model
{
    protected $table = 'whatsapp_connections';

    protected $guarded = [];

    protected $hidden = ['access_token_enc', 'verify_token', 'verification_code'];

    protected $casts = [
        'access_token_enc' => 'encrypted', // AES-256 via APP_KEY (Laravel encrypter, GCM when cipher=aes-256-gcm)
        'connected_at' => 'datetime', 'last_webhook_at' => 'datetime', 'conversation_reset_at' => 'datetime',
        'metadata' => 'array',
    ];

    protected $attributes = ['metadata' => '{}'];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
