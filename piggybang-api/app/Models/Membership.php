<?php

namespace App\Models;

use App\Models\Concerns\Auditable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Membership extends Model
{
    use Auditable;

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = ['invitation_accepted_at' => 'datetime', 'joined_at' => 'datetime'];

    public const PERMISSIONS = [
        'owner' => ['transactions.view', 'transactions.write', 'categories.write', 'rules.write', 'bills.write', 'members.manage', 'whatsapp.manage', 'billing.manage', 'organization.delete'],
        'admin' => ['transactions.view', 'transactions.write', 'categories.write', 'rules.write', 'bills.write', 'members.manage', 'whatsapp.manage'],
        'member' => ['transactions.view', 'transactions.write', 'categories.write', 'bills.write'],
        'viewer' => ['transactions.view'],
    ];

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function permissions(): array
    {
        return self::PERMISSIONS[$this->role] ?? [];
    }

    public function can(string $permission): bool
    {
        return in_array($permission, $this->permissions(), true);
    }
}
