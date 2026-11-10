<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Services\BillingService;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function show(Organization $org)
    {
        $sub = $org->currentSubscription();

        return [
            'plan' => $org->plan, 'effective_plan' => $org->effectivePlan(), 'status' => $sub?->status ?? ($org->isTrialing() ? 'trialing' : 'none'),
            'provider' => $sub?->provider, 'interval' => $sub?->interval, 'extra_seats' => $sub?->extra_seats ?? 0,
            'tier' => $sub?->tier ?? ($org->isTrialing() ? 'trial' : null), 'bot_packs' => (int) $sub?->bot_packs,
            'deferred_addon_total' => $sub ? collect(BillingService::deferredCharges($sub))->sum('amount') : 0, // joins the next invoice
            'bot_quota' => $org->botQuota(), 'bot_used' => (int) $org->whatsappConnection?->monthly_conversations,
            'whatsapp_mode' => $org->isPro() ? 'all_in' : null, 'current_period_start' => $sub?->current_period_start?->toIso8601String(),
            'current_period_end' => $sub?->current_period_end?->toIso8601String(), 'cancel_at_period_end' => (bool) $sub?->cancel_at_period_end,
            'trial_ends_at' => $org->trial_ends_at?->toIso8601String(),
            'currency' => $sub?->provider === 'stripe' ? 'USD' : 'IDR',
            'monthly_total' => BillingService::monthlyTotal($sub),
            'invoices' => $org->invoices()->latest('id')->limit(24)->get()->map(fn ($i) => [
                'date' => $i->created_at->toIso8601String(), 'description' => $i->description, 'amount' => $i->amount,
                'currency' => $i->currency, 'status' => $i->status, 'url' => $i->url,
            ]),
        ];
    }

    public function checkout(Request $request, Organization $org)
    {
        $data = $request->validate([
            'plan' => 'required|in:pro', 'tier' => 'nullable|in:'.implode(',', array_keys(config('billing.tiers'))), 'interval' => 'required|in:monthly,yearly', 'extra_seats' => 'nullable|integer|between:0,500',
            'bot_packs' => 'nullable|integer|between:0,100', 'provider' => 'nullable|in:xendit,stripe',
        ]);
        $data['extra_seats'] = (int) ($data['extra_seats'] ?? 0);
        $data['bot_packs'] = (int) ($data['bot_packs'] ?? 0);
        $data['tier'] ??= 'pro';
        // Spec routing: Indonesia → Xendit, elsewhere → Stripe. Country from CDN header when present.
        $country = strtoupper((string) ($request->header('CF-IPCountry') ?? 'ID'));
        $data['provider'] ??= $country === 'ID' ? 'xendit' : 'stripe';
        abort_unless(config('services.'.$data['provider'].'.secret'), 503, 'Pembayaran belum dikonfigurasi.');

        return ['url' => BillingService::checkout($org, $request->user(), $data)]; // null = applied, nothing to pay
    }

    public function portal(Organization $org)
    {
        return ['url' => BillingService::portal($org)];
    }

    public function cancel(Organization $org)
    {
        $sub = $org->currentSubscription();
        abort_unless($sub, 422, 'Tidak ada langganan aktif.');

        BillingService::cancel($sub);

        return $this->show($org);
    }
}
