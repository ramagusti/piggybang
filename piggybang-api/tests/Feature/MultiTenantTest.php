<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class MultiTenantTest extends TestCase
{
    use RefreshDatabase;

    public function test_org_a_cannot_see_org_b_data(): void
    {
        [$a, $orgA] = $this->makeOrg();
        [$b, $orgB] = $this->makeOrg();
        $txB = $orgB->transactions()->create(['type' => 'expense', 'amount' => 1000, 'transaction_time' => now()]);
        $txA = $orgA->transactions()->create(['type' => 'expense', 'amount' => 2000, 'transaction_time' => now()]);

        Sanctum::actingAs($a, ['*']);
        $this->getJson("/api/organizations/{$orgA->id}/transactions")->assertOk()->assertJsonFragment(['id' => $txA->id])->assertJsonMissing(['id' => $txB->id]);
        $this->getJson("/api/organizations/{$orgB->id}/transactions")->assertNotFound();
        // Scoped binding: B's transaction through A's URL
        $this->getJson("/api/organizations/{$orgA->id}/transactions/{$txB->id}")->assertNotFound();
        $this->deleteJson("/api/organizations/{$orgA->id}/transactions/{$txB->id}")->assertNotFound();
        // Category from another org can't be used
        $this->postJson("/api/organizations/{$orgA->id}/transactions", [
            'type' => 'expense', 'amount' => 5, 'transaction_time' => now()->toIso8601String(), 'category_id' => $this->cat($orgB, 'Other')->id,
        ])->assertUnprocessable();
    }

    public function test_viewer_cannot_write_and_member_cannot_manage_rules(): void
    {
        [$owner, $org] = $this->makeOrg('pro');
        $viewer = User::factory()->create();
        $member = User::factory()->create();
        $org->memberships()->create(['user_id' => $viewer->id, 'role' => 'viewer']);
        $org->memberships()->create(['user_id' => $member->id, 'role' => 'member']);
        $payload = ['type' => 'expense', 'amount' => 5, 'transaction_time' => now()->toIso8601String(), 'category_id' => $this->cat($org, 'Other')->id];

        Sanctum::actingAs($viewer, ['*']);
        $this->getJson("/api/organizations/{$org->id}/transactions")->assertOk();
        $this->postJson("/api/organizations/{$org->id}/transactions", $payload)->assertForbidden();

        Sanctum::actingAs($member, ['*']);
        $this->postJson("/api/organizations/{$org->id}/transactions", $payload)->assertCreated();
        $this->postJson("/api/organizations/{$org->id}/rules", ['name' => 'x', 'type' => 'weekly_limit', 'limit_amount' => 1])->assertForbidden();
        $this->getJson("/api/organizations/{$org->id}/subscription")->assertForbidden();
    }

    public function test_api_token_is_scoped_to_one_org(): void
    {
        [$owner, $orgA] = $this->makeOrg('pro');
        [, $orgB] = $this->makeOrg('pro', $owner); // same owner, two orgs
        $token = $owner->createToken('cli', ['org:'.$orgA->id])->plainTextToken;

        $this->withToken($token)->getJson("/api/organizations/{$orgA->id}/transactions")->assertOk();
        $this->withToken($token)->getJson("/api/organizations/{$orgB->id}/transactions")->assertForbidden();
    }
}
