<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TourTest extends TestCase
{
    use RefreshDatabase;

    public function test_tour_progress_end_and_replay_are_recorded_per_user(): void
    {
        [$owner] = $this->makeOrg();
        Sanctum::actingAs($owner, ['*']);
        $this->getJson('/api/user')->assertJsonPath('user.tour_status', null);

        $this->patchJson('/api/user/tour', ['step' => 'budget-ai'])->assertOk()->assertJsonPath('user.tour_step', 'budget-ai');
        $this->patchJson('/api/user/tour', ['status' => 'skipped', 'step' => 'wa-chats'])->assertOk();
        $user = $owner->fresh();
        $this->assertSame(['skipped', 'wa-chats'], [$user->tour_status, $user->tour_step]);
        $this->assertNotNull($user->tour_finished_at);

        $this->patchJson('/api/user/tour', ['status' => null])->assertOk(); // replay from Settings
        $this->assertSame([null, null, null], [$owner->fresh()->tour_status, $owner->fresh()->tour_step, $owner->fresh()->tour_finished_at]);
        $this->patchJson('/api/user/tour', ['status' => 'done'])->assertUnprocessable();
    }
}
