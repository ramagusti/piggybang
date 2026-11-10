<?php

namespace Tests\Feature;

use App\Jobs\ProcessWhatsAppMessage;
use App\Models\Membership;
use App\Models\Organization;
use App\Models\User;
use App\Models\WhatsAppSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class WhatsAppTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config([
            'services.meta.platform_phone' => '+628000000000', 'services.meta.platform_phone_number_id' => 'PLATFORM',
            'services.meta.token' => 'tok', 'services.meta.app_secret' => 'appsecret', 'services.meta.verify_token' => 'vt',
            'services.ai.key' => 'k', 'services.ai.base_url' => 'https://ai.test/v1',
        ]);
    }

    public function test_webhook_verification_and_signature(): void
    {
        $this->get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=123')->assertOk()->assertSee('123');
        $this->get('/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=no&hub.challenge=123')->assertForbidden();
        $this->postJson('/api/webhooks/whatsapp', ['entry' => []], ['X-Hub-Signature-256' => 'sha256=bad'])->assertUnauthorized();
    }

    private bool $clarify = false;

    private ?array $ask = null; // set → the fake AI classifies the message as a question

    private function aiReturns(array $entry = []): void
    {
        Http::fake([
            'graph.facebook.com/*' => Http::response(['messages' => [['id' => 'x']]]),
            'ai.test/*' => fn () => Http::response(['choices' => [['message' => ['content' => json_encode($this->ask ? ['intent' => 'ask', 'ask' => $this->ask] : ($this->clarify
                ? ['entries' => [], 'needs_clarification' => true, 'clarification_question' => 'Berapa nominalnya?']
                : ['entries' => [$entry + [
                    'type' => 'expense', 'category' => ['name' => 'Food & Beverages'], 'description' => 'beli kopi',
                    'value' => ['amount' => 25000, 'currency' => 'IDR'], 'actor' => ['name' => 'Rama'], 'datetime' => now()->toIso8601String(),
                    'source' => 'whatsapp', 'confidence' => 0.9,
                ]], 'needs_clarification' => false, 'clarification_question' => null]))]]]]),
        ]);
    }

    private function wa(string $text, string $id, string $from = '62811'): void
    {
        (new ProcessWhatsAppMessage(['id' => $id, 'phone_number_id' => 'PLATFORM', 'from' => $from, 'name' => 'Rama', 'type' => 'text', 'text' => $text, 'media_id' => null]))->handle();
    }

    /** @return array{0: Organization, 1: User} paired Pro org + its owner */
    private function pairedOrg(): array
    {
        [$owner, $org] = $this->makeOrg('free');
        Sanctum::actingAs($owner, ['*']);
        $this->postJson("/api/organizations/{$org->id}/whatsapp/all-in/start")->assertForbidden(); // Free: no WhatsApp
        $org->update(['plan' => 'pro', 'bot_quota' => 50]);
        $code = $this->postJson("/api/organizations/{$org->id}/whatsapp/all-in/start")->assertOk()->json('pairing_code');
        $this->wa($code, 'wamid.pair');

        return [$org, $owner];
    }

    public function test_all_in_pairing_then_message_creates_transaction_with_free_reaction(): void
    {
        $this->aiReturns();
        [$org] = $this->pairedOrg();
        $this->assertSame($org->id, WhatsAppSender::where('phone', '62811')->value('organization_id'));
        $this->assertSame($org->owner_id, WhatsAppSender::where('phone', '62811')->value('user_id')); // personal link
        $this->assertSame('connected', $org->whatsappConnection()->value('status'));

        $this->wa('beli kopi 25k', 'wamid.1');
        $tx = $org->transactions()->first();
        $this->assertSame(['25000.00', 'whatsapp', 'Food & Beverages'], [$tx->amount, $tx->source, $tx->category->name]);
        Http::assertSent(fn ($r) => ($r['type'] ?? null) === 'reaction' && $r['reaction'] === ['message_id' => 'wamid.1', 'emoji' => '✅']);
        Http::assertNotSent(fn ($r) => str_contains($r['text']['body'] ?? '', 'Rp 25.000')); // no paid text for a clean entry
        $this->assertSame(1, $org->whatsappConnection()->value('monthly_conversations')); // only the pairing text
    }

    private function texts(string $needle): int
    {
        return collect(Http::recorded())->filter(fn ($p) => str_contains($p[0]['text']['body'] ?? '', $needle))->count();
    }

    public function test_notify_budgets_get_remaining_line_others_get_reaction(): void
    {
        $this->aiReturns();
        [$org] = $this->pairedOrg();
        $food = $this->cat($org, 'Food & Beverages');
        $rule = $org->rules()->create(['name' => 'Makan', 'type' => 'weekly_limit', 'limit_amount' => 200000, 'category_id' => $food->id, 'rollover_enabled' => false]);

        $this->wa('kopi 25k', 'wamid.1');
        $this->assertSame(1, $this->texts('Makan minggu ini: sisa Rp 175.000 dari Rp 200.000'));

        $rule->update(['notify' => false]); // user turned WhatsApp updates off for this budget
        $this->wa('kopi 25k', 'wamid.2');
        $this->assertSame(0, $this->texts('sisa Rp 150.000'));
        Http::assertSent(fn ($r) => ($r['reaction'] ?? null) === ['message_id' => 'wamid.2', 'emoji' => '✅']);
    }

    public function test_bill_reminder_rides_along_once_a_day(): void
    {
        $this->aiReturns();
        [$org] = $this->pairedOrg();
        $org->bills()->create(['name' => 'Listrik', 'amount' => 350000, 'due_date' => now()->addDay()->toDateString(), 'recurrence' => 'monthly']);

        $this->wa('kopi 25k', 'wamid.1');
        $this->wa('kopi 25k', 'wamid.2');
        $this->assertSame(1, $this->texts('💡 Listrik 1 hari lagi'));
        Http::assertSent(fn ($r) => ($r['reaction']['message_id'] ?? null) === 'wamid.2');
    }

    public function test_quota_runs_out_into_reactions_and_last_text_says_so(): void
    {
        $this->aiReturns();
        [$org] = $this->pairedOrg();
        $org->rules()->create(['name' => 'Makan', 'type' => 'weekly_limit', 'limit_amount' => 200000, 'category_id' => $this->cat($org, 'Food & Beverages')->id]);
        $org->whatsappConnection()->update(['monthly_conversations' => 49]); // quota 50

        $this->wa('kopi 25k', 'wamid.1'); // 50th text: sent, with the "quota used up" note
        $this->assertSame(1, $this->texts('Kuota balasan bot bulan ini habis'));

        $this->clarify = true;
        $this->wa('kopi', 'wamid.2'); // needs a question but quota is gone → ❓ reaction, no text
        Http::assertSent(fn ($r) => ($r['reaction'] ?? null) === ['message_id' => 'wamid.2', 'emoji' => '❓']);
        $this->assertSame(0, $this->texts('Berapa nominalnya'));
        $this->assertSame(50, $org->whatsappConnection()->value('monthly_conversations'));
    }

    public function test_unknown_sender_gets_instructions_once_a_day(): void
    {
        Http::fake(['graph.facebook.com/*' => Http::response([])]);
        $this->wa('halo', 'wamid.a', '62999');
        $this->wa('halo lagi', 'wamid.b', '62999');
        $this->assertSame(1, collect(Http::recorded())->filter(fn ($p) => str_contains($p[0]['text']['body'] ?? '', 'belum terhubung'))->count());
    }

    public function test_answers_questions_from_data_with_my_vs_team_scope(): void
    {
        $this->aiReturns();
        [$org, $owner] = $this->pairedOrg();
        $food = $this->cat($org, 'Food & Beverages');
        $org->transactions()->create(['type' => 'expense', 'amount' => 40000, 'category_id' => $food->id, 'description' => 'bakso', 'user_id' => $owner->id, 'transaction_time' => now()]);
        $org->transactions()->create(['type' => 'expense', 'amount' => 60000, 'category_id' => $food->id, 'description' => 'sate', 'user_id' => null, 'actor' => 'Salsa', 'transaction_time' => now()]);
        $org->rules()->create(['name' => 'Makan', 'type' => 'monthly_limit', 'limit_amount' => 500000, 'category_id' => $food->id]);

        $this->ask = ['topic' => 'transactions', 'scope' => 'me', 'type' => 'expense'];
        $this->wa('pengeluaranku bulan ini?', 'wamid.q1');
        $this->assertSame(1, $this->texts('Pengeluaran: *Rp 40.000* (1 transaksi)'));

        $this->ask = ['topic' => 'transactions', 'scope' => 'team', 'type' => 'expense'];
        $this->wa('pengeluaran tim?', 'wamid.q2');
        $this->assertSame(1, $this->texts('Pengeluaran: *Rp 100.000* (2 transaksi)'));

        $this->ask = ['topic' => 'budgets'];
        $this->wa('sisa anggaran?', 'wamid.q3');
        $this->assertSame(1, $this->texts('Makan (per siklus): sisa Rp 400.000 dari Rp 500.000'));
        $this->assertSame(0, $org->transactions()->where('source', 'whatsapp')->count()); // questions never record
    }

    public function test_billing_details_only_for_billing_managers_and_viewers_cannot_record(): void
    {
        $this->aiReturns();
        [$org] = $this->pairedOrg();
        $this->ask = ['topic' => 'billing'];
        $this->wa('paket kita apa?', 'wamid.b1');
        $this->assertSame(1, $this->texts('Ubah paket di menu Pengaturan')); // owner sees billing details

        $viewer = User::factory()->create();
        Membership::create(['organization_id' => $org->id, 'user_id' => $viewer->id, 'email' => $viewer->email, 'role' => 'viewer', 'joined_at' => now()]);
        WhatsAppSender::create(['phone' => '62822', 'channel_phone_number_id' => 'PLATFORM', 'organization_id' => $org->id, 'user_id' => $viewer->id]);
        $this->wa('paket kita apa?', 'wamid.b2', '62822');
        $this->assertSame(1, $this->texts('Detail pembayaran hanya bisa dilihat pemilik tim'));

        $this->ask = null;
        $this->wa('kopi 25k', 'wamid.b3', '62822');
        $this->assertSame(1, $this->texts('hanya bisa melihat'));
        $this->assertSame(0, $org->transactions()->count());
    }
}
