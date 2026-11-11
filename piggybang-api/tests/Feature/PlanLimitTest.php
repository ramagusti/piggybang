<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Services\BillingService;
use App\Services\OrganizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlanLimitTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_invite_beyond_member_limit_on_free_plan(): void
    {
        Notification::fake();
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        $this->postJson("/api/organizations/{$org->id}/invite", ['email' => 'one@test.com', 'role' => 'member'])->assertCreated();
        $this->postJson("/api/organizations/{$org->id}/invite", ['email' => 'new@test.com', 'role' => 'member'])
            ->assertStatus(422)->assertJsonFragment(['message' => 'Batas anggota Free tercapai. Upgrade ke Pro.', 'code' => 'plan_limit']);
        $this->postJson("/api/organizations/{$org->id}/invite", ['email' => 'v@test.com', 'role' => 'viewer'])->assertStatus(422);

        // Cancel the pending invite by membership id; ?pending=1 keeps it from matching a user id.
        $pending = $org->memberships()->whereNull('user_id')->first();
        $this->deleteJson("/api/organizations/{$org->id}/members/{$pending->id}")->assertNotFound();
        $this->deleteJson("/api/organizations/{$org->id}/members/{$pending->id}?pending=1")->assertNoContent();
        $this->deleteJson("/api/organizations/{$org->id}/members/{$owner->id}")->assertStatus(422); // owner immutable
    }

    public function test_trial_keeps_two_member_cap_and_granted_plan_expires(): void
    {
        Notification::fake();
        [$owner, $org] = $this->makeOrg('trial');
        Sanctum::actingAs($owner, ['*']);
        $this->postJson("/api/organizations/{$org->id}/invite", ['email' => 'one@test.com', 'role' => 'member'])->assertCreated();
        $this->postJson("/api/organizations/{$org->id}/invite", ['email' => 'two@test.com', 'role' => 'member'])
            ->assertStatus(422)->assertJsonPath('code', 'plan_limit')->assertJsonPath('message', 'Selama trial, tim maksimal 2 orang. Berlangganan Pro untuk mengundang lebih banyak.');

        $this->artisan('plan:grant', ['org' => $org->id, 'tier' => 'max'])->assertSuccessful();
        $org->refresh();
        $this->assertSame(['pro', 5, 350], [$org->plan, $org->memberCap(), $org->botQuota()]);
        $this->assertSame('max', $this->getJson("/api/organizations/{$org->id}/subscription")->json('tier'));
        $this->postJson("/api/organizations/{$org->id}/invite", ['email' => 'two@test.com', 'role' => 'member'])->assertCreated();

        $this->travel(32)->days();
        BillingService::runXenditLifecycle();
        $this->assertSame('free', $org->fresh()->plan);
    }

    public function test_free_category_cap_is_15_per_type(): void
    {
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        for ($i = $org->categories()->where('type', 'expense')->count(); $i < 15; $i++) {
            $this->postJson("/api/organizations/{$org->id}/categories", ['type' => 'expense', 'name' => "Cat $i"])->assertCreated();
        }
        $this->postJson("/api/organizations/{$org->id}/categories", ['type' => 'expense', 'name' => 'One too many'])
            ->assertStatus(422)->assertJsonPath('code', 'plan_limit');
        $this->postJson("/api/organizations/{$org->id}/categories", ['type' => 'income', 'name' => 'Freelance'])->assertCreated();
    }

    public function test_trial_gives_pro_limits_and_multicurrency_needs_pro(): void
    {
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        $payload = ['type' => 'expense', 'amount' => 5, 'currency' => 'USD', 'transaction_time' => now()->toIso8601String(), 'category_id' => $this->cat($org, 'Other')->id];
        $this->postJson("/api/organizations/{$org->id}/transactions", $payload)->assertStatus(422)->assertJsonPath('code', 'plan_limit');

        [$owner2, $trial] = $this->makeOrg('trial');
        Sanctum::actingAs($owner2, ['*']);
        $payload['category_id'] = $this->cat($trial, 'Other')->id;
        $this->postJson("/api/organizations/{$trial->id}/transactions", $payload)->assertCreated();
    }

    public function test_category_delete_requires_move_when_used(): void
    {
        [$owner, $org] = $this->makeOrg();
        Sanctum::actingAs($owner, ['*']);
        $food = $this->cat($org, 'Food & Beverages');
        $other = $this->cat($org, 'Transportation');
        $org->transactions()->create(['type' => 'expense', 'amount' => 1, 'transaction_time' => now(), 'category_id' => $food->id]);

        $this->deleteJson("/api/organizations/{$org->id}/categories/{$food->id}")->assertStatus(422)->assertJsonPath('transactions_count', 1);
        $this->deleteJson("/api/organizations/{$org->id}/categories/{$food->id}?move_to={$other->id}")->assertNoContent();
        $this->assertSame(1, $org->transactions()->where('category_id', $other->id)->count());
    }

    public function test_trial_is_three_days_and_only_for_first_owned_team(): void
    {
        [$owner, $first] = $this->makeOrg();
        $this->assertTrue($first->isTrialing());
        $this->assertSame(3, (int) round(now()->diffInDays($first->trial_ends_at)));

        $second = OrganizationService::create($owner, 'Tim Kedua');
        $this->assertFalse($second->isTrialing());
        $this->assertSame('free', $second->effectivePlan());
    }

    public function test_extra_teams_are_locked_until_paid(): void
    {
        [$owner, $first] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        $this->getJson("/api/organizations/{$first->id}/transactions")->assertOk(); // the first team is free

        $id = $this->postJson('/api/organizations', ['name' => 'Tim Kedua'])->assertCreated()->assertJsonPath('locked', true)->json('id');
        $this->getJson("/api/organizations/$id/transactions")->assertStatus(402)->assertJsonPath('code', 'team_payment_required');
        $this->postJson("/api/organizations/$id/transactions", [])->assertStatus(402);
        $this->getJson("/api/organizations/$id")->assertOk();
        $this->getJson("/api/organizations/$id/subscription")->assertOk(); // can still pay

        Organization::find($id)->update(['plan' => 'pro']); // what BillingService::sync does on payment
        $this->getJson("/api/organizations/$id/transactions")->assertOk();
        $this->getJson("/api/organizations/$id")->assertJsonPath('locked', false);

        Organization::find($id)->update(['plan' => 'free']); // plan lapsed → locked again, then deletable
        $this->getJson("/api/organizations/$id/transactions")->assertStatus(402);
        $this->deleteJson("/api/organizations/$id")->assertNoContent();
    }
}
