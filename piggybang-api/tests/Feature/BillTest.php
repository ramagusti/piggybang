<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BillTest extends TestCase
{
    use RefreshDatabase;

    public function test_bill_records_creator_and_guesses_category_from_name(): void
    {
        [$owner, $org] = $this->makeOrg();
        Sanctum::actingAs($owner, ['*']);
        $url = "/api/organizations/{$org->id}/bills";
        $base = ['amount' => 350000, 'due_date' => now()->addDays(5)->toDateString(), 'recurrence' => 'monthly'];

        // No AI configured: falls back to the bills-like category.
        $this->postJson($url, $base + ['name' => 'Listrik PLN'])->assertCreated()
            ->assertJsonPath('category.name', 'Bills & Subscriptions')->assertJsonPath('created_by.name', $owner->name);

        // AI picks from the team's categories; a made-up id is ignored.
        $kids = $this->cat($org, "Kid's Stuff");
        config(['services.ai.key' => 'k', 'services.ai.base_url' => 'https://ai.test/v1']);
        $answer = $kids->id;
        Http::fake(['ai.test/*' => function () use (&$answer) {
            return Http::response(['choices' => [['message' => ['content' => json_encode(['id' => $answer])]]]]);
        }]);
        $this->postJson($url, $base + ['name' => 'SPP Dara'])->assertCreated()->assertJsonPath('category_id', $kids->id);
        $answer = 999999;
        $this->postJson($url, $base + ['name' => 'Netflix'])->assertCreated()->assertJsonPath('category.name', 'Bills & Subscriptions');

        // A chosen category is never overridden.
        $food = $this->cat($org, 'Food & Beverages');
        $this->postJson($url, $base + ['name' => 'Katering', 'category_id' => $food->id])->assertCreated()->assertJsonPath('category_id', $food->id);
        $this->getJson($url)->assertOk()->assertJsonPath('0.created_by.id', $owner->id);
    }
}
