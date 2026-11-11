<?php

namespace App\Models;

use App\Support\Memo;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['name', 'email', 'password', 'avatar_url', 'locale', 'timezone', 'current_organization_id', 'last_login_at'];

    protected $hidden = ['password', 'remember_token', 'current_organization_id', 'last_login_at', 'created_at', 'updated_at'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'datetime', 'last_login_at' => 'datetime', 'password' => 'hashed'];
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    public function pushSubscriptions(): HasMany
    {
        return $this->hasMany(PushSubscription::class);
    }

    public function membershipFor(Organization|int $org): ?Membership
    {
        $orgId = is_int($org) ? $org : $org->id;

        // Middleware and resources both ask; one query per request.
        return Memo::get("membership:{$this->id}:$orgId", fn () => $this->memberships()->where('organization_id', $orgId)->first());
    }
}
