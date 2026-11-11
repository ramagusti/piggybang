<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Organization;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Pro plan + per-seat add-on + WhatsApp add-on.
 * Stripe (international): native subscriptions via Checkout; state synced from webhooks.
 * Xendit (Indonesia): one invoice per period (VA / e-wallet / retail / card); renewals issued by the scheduler.
 */
class BillingService
{
    /** @return list<array{key:string,name:string,amount:float,quantity:int,recurring:bool}> */
    public static function lineItems(string $currency, string $interval, int $extraSeats, string $tier = 'pro', int $botPacks = 0): array
    {
        $p = config("billing.prices.$currency");
        $sfx = $interval === 'yearly' ? 'yearly' : 'monthly';
        $name = 'PiggyBang! '.config("billing.tiers.$tier.name");
        $items = [['key' => "{$tier}_$sfx", 'name' => $name, 'amount' => $p["{$tier}_$sfx"], 'quantity' => 1, 'recurring' => true]];
        if ($extraSeats > 0) {
            $items[] = ['key' => "seat_$sfx", 'name' => 'Kursi tambahan', 'amount' => $p["seat_$sfx"], 'quantity' => $extraSeats, 'recurring' => true];
        }
        if ($botPacks > 0) {
            $items[] = ['key' => "pack_$sfx", 'name' => 'Balasan bot +'.config('billing.bot_pack.replies'), 'amount' => $p["pack_$sfx"], 'quantity' => $botPacks, 'recurring' => true];
        }

        return $items;
    }

    public static function monthlyTotal(?Subscription $sub): float
    {
        if (! $sub) {
            return 0;
        }
        $currency = $sub->provider === 'stripe' ? 'USD' : 'IDR';
        $total = collect(self::lineItems($currency, $sub->interval, $sub->extra_seats, $sub->tier ?? 'pro', (int) $sub->bot_packs))->sum(fn ($i) => $i['amount'] * $i['quantity']);

        return $sub->interval === 'yearly' ? round($total / 12, 2) : $total;
    }

    /** Apply a subscription's state to the organization (plan, seat cap). WhatsApp comes with Pro. */
    public static function sync(Subscription $sub): void
    {
        $active = in_array($sub->status, ['active', 'trialing', 'past_due'], true);
        $sub->organization->update($active
            ? ['plan' => 'pro', 'member_limit' => Organization::PRO_INCLUDED_MEMBERS + $sub->extra_seats, 'whatsapp_mode' => 'all_in',
                'bot_quota' => config('billing.tiers.'.($sub->tier ?? 'pro').'.bot_replies') + $sub->extra_seats * config('billing.bot_replies_per_seat')
                    + (int) $sub->bot_packs * config('billing.bot_pack.replies')]
            : ['plan' => 'free', 'member_limit' => Organization::FREE_MEMBER_LIMIT, 'whatsapp_mode' => null, 'bot_quota' => 0]);
    }

    public static function checkout(Organization $org, User $user, array $opt): ?string
    {
        $successUrl = rtrim(config('app.frontend_url'), '/').'/app/settings?tab=billing&checkout=success';
        $cancelUrl = rtrim(config('app.frontend_url'), '/').'/app/settings?tab=billing&checkout=cancel';

        $sub = $org->currentSubscription();
        if ($opt['provider'] === 'xendit' && $sub?->provider === 'xendit' && $sub->status === 'active' && $sub->current_period_end->isFuture()
            && $sub->tier === $opt['tier'] && $sub->interval === $opt['interval']) {
            return self::changeAddons($sub, $opt, $successUrl, $cancelUrl); // same plan, only add-ons change
        }

        return $opt['provider'] === 'stripe'
            ? self::stripeCheckout($org, $user, $opt, $successUrl, $cancelUrl)
            : self::xenditCheckout($org, $user, $opt, $successUrl, $cancelUrl);
    }

    /**
     * Add-ons on an active plan (same tier + interval), charged pro rata for the rest of the current period:
     * - decrease → applies now, no refund;
     * - small increase (< billing.addon_invoice_min) → applies now, charge added to the next renewal invoice;
     * - big increase, or a team that is cancelling (no renewal coming) → invoice now, applies when paid.
     * Returns the invoice URL, or null when nothing needs paying now.
     */
    private static function changeAddons(Subscription $sub, array $opt, string $ok, string $cancel): ?string
    {
        $org = $sub->organization;
        $minSeats = max(0, $org->seatsUsed() - Organization::PRO_INCLUDED_MEMBERS);
        if ($opt['extra_seats'] < $minSeats) {
            throw ValidationException::withMessages(['extra_seats' => ["Masih ada {$org->seatsUsed()} anggota/undangan. Hapus anggota dulu sebelum mengurangi kursi."]]);
        }
        $total = fn (int $seats, int $packs) => collect(self::lineItems('IDR', $sub->interval, $seats, $sub->tier, $packs))->sum(fn ($i) => $i['amount'] * $i['quantity']);
        $diff = $total($opt['extra_seats'], $opt['bot_packs']) - $total($sub->extra_seats, (int) $sub->bot_packs);
        if ($diff <= 0) {
            $sub->update(['extra_seats' => $opt['extra_seats'], 'bot_packs' => $opt['bot_packs']]);
            self::sync($sub);

            return null;
        }
        $left = max(0, now()->diffInSeconds($sub->current_period_end, false)) / max(1, $sub->current_period_start->diffInSeconds($sub->current_period_end));
        $amount = (int) (round($diff * $left / 100) * 100);
        $what = collect([
            $opt['extra_seats'] !== $sub->extra_seats ? 'kursi '.$sub->extra_seats.'→'.$opt['extra_seats'] : null,
            $opt['bot_packs'] !== (int) $sub->bot_packs ? 'paket balasan '.$sub->bot_packs.'→'.$opt['bot_packs'] : null,
        ])->filter()->implode(', ');
        $item = ['key' => 'addon', 'name' => "Tambahan ($what), prorata s.d. ".$sub->current_period_end->format('j/n/Y'), 'amount' => $amount, 'quantity' => 1, 'recurring' => false];
        if ($amount < config('billing.addon_invoice_min') && ! $sub->cancel_at_period_end) {
            $sub->update([
                'extra_seats' => $opt['extra_seats'], 'bot_packs' => $opt['bot_packs'],
                'metadata' => array_merge($sub->metadata ?? [], ['addon_charges' => [...self::deferredCharges($sub), $item]]),
            ]);
            self::sync($sub);

            return null;
        }

        return self::createXenditInvoice($sub, [$item], $ok, $cancel, 'addon', ['extra_seats' => $opt['extra_seats'], 'bot_packs' => $opt['bot_packs']])->url;
    }

    /** Pro rata add-on charges waiting for the next renewal invoice. */
    public static function deferredCharges(Subscription $sub): array
    {
        return $sub->metadata['addon_charges'] ?? [];
    }

    /** Invoice $items plus any deferred add-on charges, then clear them (they're on this invoice now). */
    private static function invoiceWithDeferred(Subscription $sub, array $items, string $kind = 'period'): ?Invoice
    {
        $items = [...$items, ...self::deferredCharges($sub)];
        if (! $items) {
            return null;
        }
        $invoice = self::createXenditInvoice($sub, $items, kind: $kind);
        $sub->update(['metadata' => array_merge($sub->metadata ?? [], ['addon_charges' => []])]);

        return $invoice;
    }

    // ---------------- Stripe ----------------

    private static function stripe()
    {
        return Http::withToken(config('services.stripe.secret'))->asForm()->baseUrl('https://api.stripe.com/v1')->timeout(20);
    }

    private static function stripeCheckout(Organization $org, User $user, array $opt, string $ok, string $cancel): string
    {
        $existing = $org->subscriptions()->where('provider', 'stripe')->whereIn('status', ['active', 'past_due', 'trialing'])->first();
        if ($existing) { // already subscribed → manage seats/add-ons in the portal
            return self::portal($org);
        }
        $form = [
            'mode' => 'subscription', 'success_url' => $ok, 'cancel_url' => $cancel, 'client_reference_id' => $org->id,
            'subscription_data' => ['metadata' => ['organization_id' => $org->id, 'extra_seats' => $opt['extra_seats'], 'interval' => $opt['interval'], 'tier' => $opt['tier'], 'bot_packs' => $opt['bot_packs']]],
            'line_items' => [],
        ];
        $customer = $org->subscriptions()->where('provider', 'stripe')->value('provider_customer_id');
        $customer ? $form['customer'] = $customer : $form['customer_email'] = $user->email;
        foreach (self::lineItems('USD', $opt['interval'], $opt['extra_seats'], $opt['tier'], $opt['bot_packs']) as $i) {
            $form['line_items'][] = [
                'quantity' => $i['quantity'],
                'price_data' => array_filter([
                    'currency' => 'usd', 'unit_amount' => (int) round($i['amount'] * 100),
                    'product_data' => ['name' => $i['name'], 'metadata' => ['key' => $i['key']]],
                    'recurring' => $i['recurring'] ? ['interval' => $opt['interval'] === 'yearly' ? 'year' : 'month'] : null,
                ]),
            ];
        }

        return self::stripe()->post('checkout/sessions', $form)->throw()->json('url');
    }

    public static function portal(Organization $org): ?string
    {
        $sub = $org->currentSubscription();
        if ($sub?->provider === 'stripe') {
            return self::stripe()->post('billing_portal/sessions', [
                'customer' => $sub->provider_customer_id,
                'return_url' => rtrim(config('app.frontend_url'), '/').'/app/settings?tab=billing',
            ])->throw()->json('url');
        }

        return $org->invoices()->where('provider', 'xendit')->where('status', 'pending')->latest('id')->value('url');
    }

    public static function cancel(Subscription $sub): Subscription
    {
        if ($sub->provider === 'stripe') {
            self::stripe()->post("subscriptions/{$sub->provider_subscription_id}", ['cancel_at_period_end' => 'true'])->throw();
        }
        $sub->update(['cancel_at_period_end' => true]);
        if ($sub->provider === 'xendit') { // no renewal invoice will carry them: bill waiting add-on charges now
            self::invoiceWithDeferred($sub, [], 'addon_due');
        }

        return $sub;
    }

    public static function verifyStripeSignature(string $payload, string $header): bool
    {
        $parts = collect(explode(',', $header))->mapToGroups(fn ($p) => [trim(Str::before($p, '=')) => Str::after($p, '=')]);
        $t = (int) ($parts['t'][0] ?? 0);
        if (! $t || abs(time() - $t) > 300 || ! config('services.stripe.webhook_secret')) {
            return false;
        }
        $expected = hash_hmac('sha256', "$t.$payload", config('services.stripe.webhook_secret'));

        return collect($parts['v1'] ?? [])->contains(fn ($sig) => hash_equals($expected, $sig));
    }

    public static function handleStripeEvent(array $event): void
    {
        $obj = $event['data']['object'];
        switch ($event['type']) {
            case 'checkout.session.completed':
                if ($obj['subscription'] ?? null) {
                    self::syncStripeSubscription(self::stripe()->get("subscriptions/{$obj['subscription']}")->throw()->json());
                }
                break;
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                self::syncStripeSubscription($obj);
                break;
            case 'invoice.paid':
            case 'invoice.payment_failed':
                $sub = Subscription::where(['provider' => 'stripe', 'provider_subscription_id' => $obj['subscription'] ?? $obj['parent']['subscription_details']['subscription'] ?? ''])->first();
                if ($sub) {
                    Invoice::updateOrCreate(['provider_invoice_id' => $obj['id']], [
                        'organization_id' => $sub->organization_id, 'subscription_id' => $sub->id, 'provider' => 'stripe',
                        'description' => $obj['lines']['data'][0]['description'] ?? 'PiggyBang! Pro',
                        'amount' => ($obj['amount_paid'] ?: $obj['amount_due']) / 100, 'currency' => strtoupper($obj['currency']),
                        'status' => $event['type'] === 'invoice.paid' ? 'paid' : 'failed', 'url' => $obj['hosted_invoice_url'] ?? null,
                        'paid_at' => $event['type'] === 'invoice.paid' ? now() : null,
                    ]);
                }
                break;
        }
    }

    private static function syncStripeSubscription(array $s): void
    {
        $orgId = $s['metadata']['organization_id'] ?? null;
        if (! $orgId || ! Organization::find($orgId)) {
            return;
        }
        $item = $s['items']['data'][0] ?? [];
        $seats = 0;
        foreach ($s['items']['data'] ?? [] as $it) {
            $key = $it['price']['metadata']['key'] ?? $it['plan']['metadata']['key'] ?? null;
            $name = $it['price']['product']['name'] ?? '';
            if (str_starts_with((string) $key, 'seat_') || str_contains($name, 'Kursi')) {
                $seats = $it['quantity'];
            }
        }
        $seats = $seats ?: (int) ($s['metadata']['extra_seats'] ?? 0);
        $sub = Subscription::updateOrCreate(['provider' => 'stripe', 'provider_subscription_id' => $s['id']], [
            'organization_id' => $orgId, 'provider_customer_id' => $s['customer'], 'plan' => 'pro',
            'interval' => ($item['price']['recurring']['interval'] ?? 'month') === 'year' ? 'yearly' : 'monthly',
            'extra_seats' => $seats, 'tier' => $s['metadata']['tier'] ?? 'pro', 'bot_packs' => (int) ($s['metadata']['bot_packs'] ?? 0),
            'status' => match ($s['status']) {
                'active' => 'active', 'trialing' => 'trialing', 'past_due', 'unpaid' => 'past_due', 'incomplete' => 'incomplete', default => 'canceled'
            },
            'current_period_start' => Carbon::createFromTimestamp($s['current_period_start'] ?? $item['current_period_start'] ?? time()),
            'current_period_end' => Carbon::createFromTimestamp($s['current_period_end'] ?? $item['current_period_end'] ?? time()),
            'cancel_at_period_end' => (bool) ($s['cancel_at_period_end'] ?? false),
        ]);
        self::sync($sub);
    }

    // ---------------- Xendit ----------------

    private static function xendit()
    {
        return Http::withBasicAuth((string) config('services.xendit.secret'), '')->baseUrl('https://api.xendit.co')->timeout(20);
    }

    private static function xenditCheckout(Organization $org, User $user, array $opt, string $ok, string $cancel): string
    {
        $sub = $org->subscriptions()->where('provider', 'xendit')->latest('id')->first();
        $sub = $sub && in_array($sub->status, ['active', 'past_due', 'incomplete'], true) ? $sub : new Subscription([
            'organization_id' => $org->id, 'provider' => 'xendit', 'provider_subscription_id' => 'xendit-'.$org->id.'-'.Str::lower(Str::random(8)),
            'provider_customer_id' => $user->email, 'plan' => 'pro', 'status' => 'incomplete',
            'current_period_start' => now(), 'current_period_end' => now(),
        ]);
        $sub->save();
        // ponytail: plan changes on Xendit start a fresh full period when paid (no proration); add credits if users complain.
        $pending = ['interval' => $opt['interval'], 'extra_seats' => $opt['extra_seats'], 'tier' => $opt['tier'], 'bot_packs' => $opt['bot_packs']];

        return self::createXenditInvoice($sub, self::lineItems('IDR', $opt['interval'], $opt['extra_seats'], $opt['tier'], $opt['bot_packs']), $ok, $cancel, 'period', $pending)->url;
    }

    public static function createXenditInvoice(Subscription $sub, array $items, ?string $ok = null, ?string $cancel = null, string $kind = 'period', ?array $pending = null): Invoice
    {
        $amount = collect($items)->sum(fn ($i) => $i['amount'] * $i['quantity']);
        $external = 'pb-'.$sub->organization_id.'-'.Str::uuid();
        $description = collect($items)->map(fn ($i) => $i['name'].($i['quantity'] > 1 ? " ×{$i['quantity']}" : ''))->implode(' + ');
        $res = self::xendit()->post('v2/invoices', array_filter([
            'external_id' => $external, 'amount' => $amount, 'currency' => 'IDR', 'payer_email' => $sub->organization->owner->email,
            'description' => $description, 'success_redirect_url' => $ok, 'failure_redirect_url' => $cancel,
            'invoice_duration' => 7 * 86400,
            'payment_methods' => config('services.xendit.payment_methods') ?: null,
            'items' => collect($items)->map(fn ($i) => ['name' => $i['name'], 'quantity' => $i['quantity'], 'price' => $i['amount']])->all(),
        ]))->throw()->json();

        return Invoice::create([
            'organization_id' => $sub->organization_id, 'subscription_id' => $sub->id, 'provider' => 'xendit',
            'provider_invoice_id' => $res['id'], 'description' => $description, 'amount' => $amount, 'currency' => 'IDR',
            'status' => 'pending', 'url' => $res['invoice_url'], 'kind' => $kind, 'metadata' => $pending ? ['pending' => $pending] : [],
        ]);
    }

    public static function handleXenditCallback(array $payload): void
    {
        $invoice = Invoice::where(['provider' => 'xendit', 'provider_invoice_id' => $payload['id'] ?? ''])->first();
        if (! $invoice || $invoice->status === 'paid') {
            return; // unknown or already processed (idempotent)
        }
        $status = strtoupper($payload['status'] ?? '');
        if ($status === 'EXPIRED') {
            $invoice->update(['status' => 'expired']);

            return;
        }
        if (! in_array($status, ['PAID', 'SETTLED'], true)) {
            return;
        }
        $invoice->update(['status' => 'paid', 'paid_at' => now()]);
        $sub = $invoice->subscription_id ? Subscription::find($invoice->subscription_id) : null;
        if (! $sub || in_array($invoice->kind, ['overage', 'addon_due'], true)) { // one-off charges: nothing to apply
            return;
        }
        $pending = $invoice->metadata['pending'] ?? null;
        if ($invoice->kind === 'addon') { // mid-period add-on: same period, more capacity now
            $sub->update(['extra_seats' => $pending['extra_seats'], 'bot_packs' => $pending['bot_packs']]);
            self::sync($sub);

            return;
        }
        $interval = $pending['interval'] ?? $sub->interval;
        // Renewal extends from the current end (or now if lapsed); a new purchase / plan change starts now.
        $start = (! $pending && $sub->current_period_end->isFuture()) ? $sub->current_period_end->copy() : now();
        $sub->update([
            'status' => 'active', 'interval' => $interval,
            'extra_seats' => $pending['extra_seats'] ?? $sub->extra_seats,
            'tier' => $pending['tier'] ?? $sub->tier,
            'bot_packs' => $pending['bot_packs'] ?? $sub->bot_packs,
            'current_period_start' => $start, 'current_period_end' => $interval === 'yearly' ? $start->copy()->addYear() : $start->copy()->addMonthNoOverflow(),
            'cancel_at_period_end' => false,
        ]);
        self::sync($sub);
    }

    /** Daily: issue renewal invoices 3 days before period end; expire lapsed subscriptions (incl. plans granted by hand). */
    public static function runXenditLifecycle(): void
    {
        foreach (Subscription::where('provider', 'manual')->where('status', 'active')->where('current_period_end', '<', now())->get() as $sub) {
            $sub->update(['status' => 'canceled']);
            self::sync($sub);
        }
        foreach (Subscription::where('provider', 'xendit')->whereIn('status', ['active', 'past_due'])->get() as $sub) {
            $end = $sub->current_period_end;
            if ($sub->cancel_at_period_end && $end->isPast()) {
                $sub->update(['status' => 'canceled']);
                self::sync($sub);

                continue;
            }
            if ($end->isPast()) {
                $graceOver = $end->copy()->addDays(config('billing.past_due_grace_days'))->isPast();
                $sub->update(['status' => $graceOver ? 'canceled' : 'past_due']);
                self::sync($sub);
            }
            $hasPending = Invoice::where('subscription_id', $sub->id)->where('status', 'pending')->where('created_at', '>', $end->copy()->subDays(5))->exists();
            if (! $sub->cancel_at_period_end && $sub->status !== 'canceled' && $end->copy()->subDays(3)->isPast() && ! $hasPending) {
                self::invoiceWithDeferred($sub, self::lineItems('IDR', $sub->interval, $sub->extra_seats, $sub->tier ?? 'pro', (int) $sub->bot_packs));
            }
        }
    }
}
