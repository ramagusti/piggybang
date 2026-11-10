<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class IngestionTest extends TestCase
{
    use RefreshDatabase;

    private function payload($org): array
    {
        return ['output' => ['entries' => [[
            'type' => 'expense', 'category' => ['name' => 'food & beverages'], 'description' => 'makan siang',
            'value' => ['amount' => 25000, 'currency' => 'IDR'], 'actor' => ['name' => 'Rama'],
            'datetime' => '2026-11-06T12:30:00+07:00', 'source' => 'whatsapp', 'confidence' => 0.95,
        ]], 'needs_clarification' => false, 'clarification_question' => null]];
    }

    public function test_requires_valid_hmac(): void
    {
        config(['services.ingest.secret' => 's3cret']);
        [, $org] = $this->makeOrg();
        $this->postJson('/api/entries/ingest', $this->payload($org), ['X-Organization-ID' => $org->id, 'X-Webhook-Signature' => 'bad'])->assertUnauthorized();
        $this->assertSame(0, $org->transactions()->count());
    }

    public function test_ingests_entries_with_metadata(): void
    {
        config(['services.ingest.secret' => 's3cret']);
        [$owner, $org] = $this->makeOrg();
        $body = json_encode($this->payload($org));
        $res = $this->call('POST', '/api/entries/ingest', [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json',
            'HTTP_X_ORGANIZATION_ID' => $org->id, 'HTTP_X_USER_ID' => $owner->id,
            'HTTP_X_WEBHOOK_SIGNATURE' => hash_hmac('sha256', $body, 's3cret'),
        ], $body);

        $res->assertOk()->assertJsonPath('transactions.0.category.name', 'Food & Beverages')
            ->assertJsonPath('transactions.0.source', 'whatsapp')->assertJsonPath('transactions.0.user.id', $owner->id)
            ->assertJsonStructure(['metadata' => ['budget_warnings', 'reminders', 'savings' => ['cycle_start', 'net_savings']]]);
    }
}
