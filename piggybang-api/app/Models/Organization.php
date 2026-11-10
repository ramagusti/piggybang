<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Organization extends Model
{
    protected $guarded = [];

    protected $casts = ['settings' => 'array', 'trial_ends_at' => 'datetime'];

    protected $attributes = ['settings' => '{}'];

    public const FREE_MEMBER_LIMIT = 2;

    public const PRO_INCLUDED_MEMBERS = 5;

    public const FREE_CATEGORY_LIMIT = 15;

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    public function activeMemberships(): HasMany
    {
        return $this->memberships()->whereNotNull('user_id');
    }

    public function categories(): HasMany
    {
        return $this->hasMany(TransactionCategory::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class);
    }

    public function rules(): HasMany
    {
        return $this->hasMany(UserRule::class);
    }

    public function savings(): HasMany
    {
        return $this->hasMany(Savings::class);
    }

    public function bills(): HasMany
    {
        return $this->hasMany(Bill::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class);
    }

    public function whatsappConnection(): HasOne
    {
        return $this->hasOne(WhatsAppConnection::class);
    }

    public function currentSubscription(): ?Subscription
    {
        return $this->subscriptions()->whereIn('status', ['active', 'past_due', 'trialing'])->latest('id')->first();
    }

    public function isTrialing(): bool
    {
        return $this->plan === 'free' && $this->trial_ends_at?->isFuture();
    }

    public function effectivePlan(): string
    {
        return $this->isTrialing() ? 'pro' : $this->plan;
    }

    public function isPro(): bool
    {
        return $this->effectivePlan() === 'pro';
    }

    public function memberCap(): int
    {
        return $this->isPro() ? max($this->member_limit, self::PRO_INCLUDED_MEMBERS) : self::FREE_MEMBER_LIMIT;
    }

    public function categoryCap(): ?int
    {
        return $this->isPro() ? null : self::FREE_CATEGORY_LIMIT;
    }

    public function timezone(): string
    {
        return $this->settings['timezone'] ?? 'Asia/Jakarta';
    }

    public function currency(): string
    {
        return $this->settings['currency'] ?? 'IDR';
    }

    /** WhatsApp text replies the bot may send this month (reactions are unlimited). Set from the tier by BillingService::sync. */
    public function botQuota(): int
    {
        if ($this->plan === 'pro') {
            return (int) $this->bot_quota;
        }

        return $this->isTrialing() ? (int) config('billing.trial_bot_replies') : 0;
    }

    /** Members + pending invites count against the cap. */
    public function seatsUsed(): int
    {
        return $this->memberships()->count();
    }
}
