<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Membership;
use App\Services\BillingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillingTest extends TestCase
{
    use RefreshDatabase;

    public function test_stripe_webhook_requires_signature_and_syncs_plan(): void
    {
        config(['services.stripe.webhook_secret' => 'whsec_test']);
        [, $org] = $this->makeOrg('free');
        $event = json_encode(['type' => 'customer.subscription.updated', 'data' => ['object' => [
            'id' => 'sub_1', 'customer' => 'cus_1', 'status' => 'active', 'cancel_at_period_end' => false,
            'metadata' => ['organization_id' => (string) $org->id, 'extra_seats' => '2'],
            'items' => ['data' => [['quantity' => 1, 'price' => ['recurring' => ['interval' => 'month']], 'current_period_start' => time(), 'current_period_end' => time() + 2592000]]],
        ]]]);
        $post = fn ($sig) => $this->call('POST', '/api/webhooks/stripe', [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_STRIPE_SIGNATURE' => $sig], $event);

        $post('t='.time().',v1=deadbeef')->assertStatus(400);
        $t = time();
        $post("t=$t,v1=".hash_hmac('sha256', "$t.$event", 'whsec_test'))->assertOk();

        $org->refresh();
        $this->assertSame(['pro', 7, 'all_in'], [$org->plan, $org->memberCap(), $org->whatsapp_mode]); // WhatsApp comes with Pro
    }

    public function test_xendit_checkout_then_paid_callback_activates_pro(): void
    {
        config(['services.xendit.secret' => 'xnd_test', 'services.xendit.callback_token' => 'cb']);
        Http::fake(['api.xendit.co/*' => Http::response(['id' => 'inv_1', 'invoice_url' => 'https://checkout.xendit.co/inv_1'])]);
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);

        $this->postJson("/api/organizations/{$org->id}/subscription/checkout", ['plan' => 'pro', 'tier' => 'plus', 'interval' => 'monthly', 'extra_seats' => 1])
            ->assertOk()->assertJsonPath('url', 'https://checkout.xendit.co/inv_1');
        Http::assertSent(fn ($r) => $r['amount'] == 110000 + 15000 // Plus monthly + 1 extra seat
            && $r['payment_methods'] === ['QRIS', 'OVO', 'DANA', 'SHOPEEPAY', 'LINKAJA']); // no bank transfer
        $this->assertSame('free', $org->fresh()->plan);

        $this->postJson('/api/webhooks/xendit', ['id' => 'inv_1', 'status' => 'PAID'], ['x-callback-token' => 'wrong'])->assertUnauthorized();
        $this->postJson('/api/webhooks/xendit', ['id' => 'inv_1', 'status' => 'PAID'], ['x-callback-token' => 'cb'])->assertOk();
        $this->postJson('/api/webhooks/xendit', ['id' => 'inv_1', 'status' => 'PAID'], ['x-callback-token' => 'cb'])->assertOk(); // idempotent

        $org->refresh();
        $this->assertSame(['pro', 6, 'all_in'], [$org->plan, $org->memberCap(), $org->whatsapp_mode]);
        $this->assertSame('paid', Invoice::first()->status);
        $this->getJson("/api/organizations/{$org->id}/subscription")->assertJsonPath('status', 'active')->assertJsonPath('monthly_total', 125000)->assertJsonPath('bot_quota', 160); // 150 Plus + 10 per seat
    }

    public function test_addons_mid_period_are_prorated_and_keep_the_period(): void
    {
        config(['services.xendit.secret' => 'xnd_test', 'services.xendit.callback_token' => 'cb']);
        $n = 0;
        Http::fake(['api.xendit.co/*' => function () use (&$n) {
            $n++;

            return Http::response(['id' => "inv_$n", 'invoice_url' => "https://checkout.xendit.co/inv_$n"]);
        }]);
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        $url = "/api/organizations/{$org->id}/subscription/checkout";
        $paid = fn (string $id) => $this->postJson('/api/webhooks/xendit', ['id' => $id, 'status' => 'PAID'], ['x-callback-token' => 'cb'])->assertOk();

        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly'])->assertOk();
        $paid('inv_1');
        $end = $org->currentSubscription()->current_period_end->toIso8601String();
        $this->assertSame(50, $org->fresh()->botQuota());

        $this->travel(15)->days(); // about half the period left
        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly', 'bot_packs' => 2, 'extra_seats' => 1])
            ->assertOk()->assertJsonPath('url', 'https://checkout.xendit.co/inv_2');
        $charged = (int) Http::recorded()[1][0]['amount'];
        $this->assertTrue($charged > 30000 && $charged < 50000, "pro rata of Rp 75.000/month, got $charged"); // 2×30k + 15k
        $this->assertSame(50, $org->fresh()->botQuota()); // not before payment

        $paid('inv_2');
        $sub = $org->currentSubscription();
        $this->assertSame([1, 2, $end], [$sub->extra_seats, (int) $sub->bot_packs, $sub->current_period_end->toIso8601String()]); // same period
        $this->assertSame(50 + 10 + 100, $org->fresh()->botQuota());

        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly', 'bot_packs' => 0, 'extra_seats' => 1])
            ->assertOk()->assertJsonPath('url', null); // decrease: applied now, nothing to pay
        $this->assertSame(60, $org->fresh()->botQuota());

        foreach (range(1, 5) as $i) { // 6 seats used → 1 extra seat needed
            Membership::create(['organization_id' => $org->id, 'email' => "m$i@test.dev", 'role' => 'member']);
        }
        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly', 'extra_seats' => 0])->assertStatus(422)->assertJsonValidationErrors('extra_seats');
    }

    public function test_small_addons_apply_now_and_ride_on_the_renewal_invoice(): void
    {
        config(['services.xendit.secret' => 'xnd_test', 'services.xendit.callback_token' => 'cb']);
        $n = 0;
        Http::fake(['api.xendit.co/*' => function () use (&$n) {
            $n++;

            return Http::response(['id' => "inv_$n", 'invoice_url' => "https://checkout.xendit.co/inv_$n"]);
        }]);
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        $url = "/api/organizations/{$org->id}/subscription/checkout";
        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly'])->assertOk();
        $this->postJson('/api/webhooks/xendit', ['id' => 'inv_1', 'status' => 'PAID'], ['x-callback-token' => 'cb'])->assertOk();

        $this->travel(25)->days(); // ~5 days left: +1 pack ≈ Rp 5.000 pro rata, under the Rp 25k invoice minimum
        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly', 'bot_packs' => 1])->assertOk()->assertJsonPath('url', null);
        $this->assertSame(100, $org->fresh()->botQuota()); // applied immediately
        $this->assertSame(1, $n); // no separate invoice
        $deferred = $this->getJson("/api/organizations/{$org->id}/subscription")->json('deferred_addon_total');
        $this->assertTrue($deferred > 0 && $deferred < 25000);

        $this->travel(3)->days(); // inside the 3-day renewal window
        BillingService::runXenditLifecycle();
        $renewal = Http::recorded()[1][0];
        $this->assertEquals(55000 + 30000 + $deferred, $renewal['amount']); // Pro + pack + deferred pro rata, one invoice
        $this->assertSame(0, $this->getJson("/api/organizations/{$org->id}/subscription")->json('deferred_addon_total'));

        // Renewal paid → new period. A small add-on, then cancelling: no renewal will carry it, so it's billed at cancel.
        $this->postJson('/api/webhooks/xendit', ['id' => 'inv_2', 'status' => 'PAID'], ['x-callback-token' => 'cb'])->assertOk();
        $this->travel(28)->days();
        $this->postJson($url, ['plan' => 'pro', 'tier' => 'pro', 'interval' => 'monthly', 'bot_packs' => 2])->assertOk()->assertJsonPath('url', null);
        $this->postJson("/api/organizations/{$org->id}/subscription/cancel")->assertOk();
        $this->assertSame(3, $n);
        $this->assertSame('addon_due', Invoice::latest('id')->value('kind'));
        $this->assertSame(0, $this->getJson("/api/organizations/{$org->id}/subscription")->json('deferred_addon_total'));
    }
}
