<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class OrganizationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $membership = $this->relationLoaded('viewerMembership') ? $this->viewerMembership : $request->user()?->membershipFor($this->resource);
        $categories = $this->categories()->selectRaw('type, COUNT(*) AS n')->groupBy('type')->pluck('n', 'type');
        $settings = $this->settings ?? [];
        if (! $membership?->can('members.manage')) {
            unset($settings['webhook_secret']);
        }

        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'plan' => $this->plan,
            'effective_plan' => $this->effectivePlan(),
            'is_trialing' => (bool) $this->isTrialing(),
            'trial_ends_at' => $this->trial_ends_at?->toIso8601String(),
            'member_limit' => $this->memberCap(),
            'whatsapp_mode' => $this->isPro() ? 'all_in' : null, // WhatsApp comes with Pro
            'settings' => $settings + ['timezone' => 'Asia/Jakarta', 'currency' => 'IDR', 'date_format' => 'd M Y', 'onboarded' => false],
            'role' => $membership?->role,
            'permissions' => $membership?->permissions() ?? [],
            'limits' => ['categories_per_type' => $this->categoryCap(), 'members' => $this->memberCap()],
            'usage' => [
                'members' => $this->seatsUsed(),
                'expense_categories' => (int) ($categories['expense'] ?? 0),
                'income_categories' => (int) ($categories['income'] ?? 0),
            ],
        ];
    }
}
