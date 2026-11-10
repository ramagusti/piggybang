<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_trial_org_with_defaults_and_token(): void
    {
        Notification::fake();
        $res = $this->postJson('/api/auth/register', [
            'name' => 'Rama', 'email' => 'rama@example.com', 'password' => 'secret123', 'organization_name' => 'Keluarga Rama',
        ])->assertCreated()->assertJsonPath('organization.effective_plan', 'pro')->assertJsonPath('organization.role', 'owner')
            ->assertJsonPath('organization.is_trialing', true);

        $this->assertSame('keluarga-rama', $res->json('organization.slug'));
        $this->assertSame(7, $res->json('organization.usage.expense_categories'));
        $this->withToken($res->json('token'))->getJson('/api/user')->assertOk()->assertJsonCount(1, 'organizations');
        // Contract shapes: bare object / bare array, paginated keeps data+meta
        $orgId = $res->json('organization.id');
        $this->withToken($res->json('token'))->getJson("/api/organizations/$orgId")->assertJsonPath('id', $orgId);
        $this->withToken($res->json('token'))->getJson("/api/organizations/$orgId/categories?type=income")->assertJsonCount(3);
        $this->withToken($res->json('token'))->getJson("/api/organizations/$orgId/transactions")->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']]);
    }

    public function test_login_rejects_bad_password_and_accepts_good(): void
    {
        User::factory()->create(['email' => 'a@b.co', 'password' => 'secret123']);
        $this->postJson('/api/auth/login', ['email' => 'a@b.co', 'password' => 'nope'])->assertUnprocessable();
        $this->postJson('/api/auth/login', ['email' => 'a@b.co', 'password' => 'secret123'])->assertOk()->assertJsonStructure(['token', 'user']);
    }

    public function test_register_via_invitation_joins_existing_org(): void
    {
        Notification::fake();
        [$owner, $org] = $this->makeOrg();
        $this->actingAs($owner)->postJson("/api/organizations/{$org->id}/invite", ['email' => 'new@example.com', 'role' => 'member'])->assertCreated();
        $token = $org->memberships()->whereNull('user_id')->value('invitation_token');

        $this->getJson("/api/invitations/$token")->assertOk()->assertJsonPath('email', 'new@example.com');
        $this->postJson('/api/auth/register', ['name' => 'New', 'email' => 'new@example.com', 'password' => 'secret123', 'invitation_token' => $token])
            ->assertCreated()->assertJsonPath('organization.id', $org->id)->assertJsonPath('organization.role', 'member');
    }
}
