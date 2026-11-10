<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SplitBillTest extends TestCase
{
    use RefreshDatabase;

    public function test_split_creates_parts_atomically_and_totals_must_match(): void
    {
        [$owner, $org] = $this->makeOrg();
        Sanctum::actingAs($owner, ['*']);
        $food = $this->cat($org, 'Food & Beverages');
        $kids = $this->cat($org, "Kid's Stuff");
        $url = "/api/organizations/{$org->id}/transactions/split";
        $base = ['type' => 'expense', 'amount' => 300000, 'description' => 'Belanja', 'transaction_time' => now()->toIso8601String()];

        $this->postJson($url, $base + ['splits' => [['amount' => 200000, 'category_id' => $food->id], ['amount' => 50000, 'category_id' => $kids->id]]])
            ->assertStatus(422)->assertJsonValidationErrors('splits');
        $this->assertSame(0, $org->transactions()->count()); // nothing saved on mismatch

        $res = $this->postJson($url, $base + ['splits' => [
            ['amount' => 200000, 'category_id' => $food->id, 'actor' => 'Rama'],
            ['amount' => 100000, 'category_id' => $kids->id, 'actor' => 'Salsa'],
        ]])->assertCreated();
        $this->assertSame(['200000.00', '100000.00'], $org->transactions()->orderBy('id')->pluck('amount')->all());
        $this->assertSame(['Rama', 'Salsa'], $org->transactions()->orderBy('id')->pluck('actor')->all());
        $res->assertJsonPath('transactions.1.split.part', 2)->assertJsonPath('transactions.1.split.of', 2)->assertJsonPath('transactions.0.split.total', 300000);
        $this->assertSame('300000.00', $res->json('metadata.savings.expense_total'));
    }
}
