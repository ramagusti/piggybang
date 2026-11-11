<?php

namespace App\Services;

use App\Models\Membership;
use App\Models\Organization;
use App\Models\TransactionCategory;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class OrganizationService
{
    public const TRIAL_DAYS = 3;

    public static function create(User $owner, string $name, ?string $slug = null): Organization
    {
        // One free team (with its Pro trial) per person. Further teams they create must be paid (Organization::isLocked).
        $trial = ! Membership::where('user_id', $owner->id)->where('role', 'owner')->exists();

        return DB::transaction(function () use ($owner, $name, $slug, $trial) {
            $org = Organization::create([
                'name' => $name,
                'slug' => $slug ?: self::uniqueSlug($name),
                'owner_id' => $owner->id,
                'plan' => 'free',
                'member_limit' => Organization::FREE_MEMBER_LIMIT,
                'settings' => ['timezone' => $owner->timezone ?? 'Asia/Jakarta', 'currency' => 'IDR', 'date_format' => 'd M Y', 'onboarded' => false],
                'trial_ends_at' => $trial ? now()->addDays(self::TRIAL_DAYS) : null,
                'paid_only' => ! $trial,
            ]);
            Membership::create([
                'organization_id' => $org->id, 'user_id' => $owner->id, 'email' => $owner->email, 'role' => 'owner',
                'invitation_accepted_at' => now(), 'joined_at' => now(),
            ]);
            foreach (TransactionCategory::DEFAULTS as $type => $cats) {
                foreach ($cats as $i => [$catName, $icon, $color]) {
                    $org->categories()->create([
                        'type' => $type, 'name' => $catName, 'icon' => $icon, 'color' => $color, 'sort_order' => $i,
                        'is_system' => in_array($catName, ['Other', 'Other Income'], true),
                    ]);
                }
            }
            $owner->update(['current_organization_id' => $org->id]);

            return $org;
        });
    }

    public static function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'org';
        $base = Str::limit($base, 80, '');
        $slug = $base;
        while (Organization::where('slug', $slug)->exists() || in_array($slug, self::RESERVED, true)) {
            $slug = $base.'-'.Str::lower(Str::random(4));
        }

        return $slug;
    }

    public const RESERVED = ['www', 'api', 'app', 'admin', 'mail', 'static', 'assets', 'docs', 'status', 'billing'];

    /** Throws 422 plan_limit when adding a seat would exceed the cap. */
    public static function assertSeatAvailable(Organization $org): void
    {
        if ($org->seatsUsed() >= $org->memberCap()) {
            throw self::planLimit(match (true) {
                $org->plan === 'pro' => 'Batas anggota tercapai. Tambah kursi di Penagihan.',
                $org->isTrialing() => 'Selama trial, tim maksimal 2 orang. Berlangganan Pro untuk mengundang lebih banyak.',
                default => 'Batas anggota Free tercapai. Upgrade ke Pro.',
            });
        }
    }

    public static function assertCategoryAvailable(Organization $org, string $type): void
    {
        $cap = $org->categoryCap();
        if ($cap !== null && $org->categories()->where('type', $type)->count() >= $cap) {
            throw self::planLimit('Batas kategori Free tercapai ('.$cap.'). Upgrade ke Pro.');
        }
    }

    public static function planLimit(string $message): ValidationException
    {
        $e = ValidationException::withMessages(['plan' => [$message]]);
        $e->response = response()->json(['message' => $message, 'code' => 'plan_limit'], 422);

        return $e;
    }
}
