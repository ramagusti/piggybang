<?php

namespace Tests\Feature;

use App\Models\PushSubscription;
use App\Models\User;
use App\Services\PushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PushTest extends TestCase
{
    use RefreshDatabase;

    private function device(User $user): void
    {
        PushSubscription::create(['user_id' => $user->id, 'endpoint' => 'https://fcm.googleapis.com/fcm/send/'.$user->id, 'p256dh' => 'k', 'auth' => 'a']);
    }

    public function test_subscribe_accepts_only_real_push_services(): void
    {
        [$owner] = $this->makeOrg();
        Sanctum::actingAs($owner, ['*']);
        $keys = ['p256dh' => 'k', 'auth' => 'a'];

        $this->postJson('/api/push/subscriptions', ['endpoint' => 'https://169.254.169.254/latest', 'keys' => $keys])->assertStatus(422);
        $this->postJson('/api/push/subscriptions', ['endpoint' => 'https://fcm.googleapis.com.evil.test/x', 'keys' => $keys])->assertStatus(422);
        $ok = ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc', 'keys' => $keys];
        $this->postJson('/api/push/subscriptions', $ok)->assertNoContent();
        $this->postJson('/api/push/subscriptions', $ok)->assertNoContent(); // same device twice = one row
        $this->assertSame(1, $owner->pushSubscriptions()->count());
        $this->deleteJson('/api/push/subscriptions', ['endpoint' => $ok['endpoint']])->assertNoContent();
        $this->assertSame(0, PushSubscription::count());
    }

    public function test_nudge_goes_only_to_subscribed_users_who_recorded_nothing_today(): void
    {
        [$idle, $org] = $this->makeOrg();
        [$busy, $org2] = $this->makeOrg();
        $this->makeOrg(); // no device: never nudged
        $this->device($idle);
        $this->device($busy);
        $tx = ['type' => 'expense', 'amount' => 1000, 'currency' => 'IDR', 'transaction_time' => now(), 'source' => 'web'];
        $org2->transactions()->create($tx + ['user_id' => $busy->id, 'category_id' => $this->cat($org2, 'Food & Beverages')->id]);
        $old = $org->transactions()->create($tx + ['user_id' => $idle->id, 'category_id' => $this->cat($org, 'Food & Beverages')->id]);
        $old->forceFill(['created_at' => now()->subDays(2)])->saveQuietly();

        PushService::$fake = [];
        PushService::nudgeIdleUsers();
        $this->assertSame([$idle->id], array_column(PushService::$fake, 0));
    }

    public function test_reminders_push_bills_within_three_days_and_payday_to_all_members(): void
    {
        [$owner, $org] = $this->makeOrg();
        $this->device($owner);
        $org->bills()->create(['name' => 'Listrik', 'amount' => 350000, 'currency' => 'IDR', 'due_date' => now()->addDays(2)->toDateString(), 'recurrence' => 'monthly', 'is_active' => true]);
        $org->bills()->create(['name' => 'Internet', 'amount' => 400000, 'currency' => 'IDR', 'due_date' => now()->addDays(9)->toDateString(), 'recurrence' => 'monthly', 'is_active' => true]);

        PushService::$fake = [];
        PushService::sendReminders();
        $titles = array_column(array_column(PushService::$fake, 1), 'title');
        $this->assertCount(1, array_filter($titles, fn ($t) => str_contains($t, 'Listrik') && str_contains($t, '2 hari lagi')));
        $this->assertCount(0, array_filter($titles, fn ($t) => str_contains($t, 'Internet')));
    }

    protected function tearDown(): void
    {
        PushService::$fake = null;
        parent::tearDown();
    }
}
