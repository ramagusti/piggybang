<?php

namespace App\Jobs;

use App\Models\Organization;
use App\Models\User;
use App\Models\WhatsAppConnection;
use App\Models\WhatsAppSender;
use App\Services\AiClient;
use App\Services\BudgetService;
use App\Services\EntryIngestionService;
use App\Services\OcrService;
use App\Services\PaydayService;
use App\Services\WhatsAppAssistant;
use App\Services\WhatsAppService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Validator;

/** One inbound WhatsApp message: route to org → (OCR) → AI extraction → transactions → reply. */
class ProcessWhatsAppMessage implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    /** @param array{id:string, phone_number_id:string, from:string, name:?string, type:string, text:?string, media_id:?string} $msg */
    public function __construct(public array $msg) {}

    public function handle(): void
    {
        $pnid = $this->msg['phone_number_id'];
        $from = $this->msg['from'];
        $text = trim((string) $this->msg['text']);
        $platform = $pnid === (string) config('services.meta.platform_phone_number_id');

        if ($platform && preg_match('/PIGGY-\d{6}/', $text, $m)) {
            $this->pair($m[0], $pnid, $from);

            return;
        }

        if (! $platform) {
            return; // only the shared Piggybang number is served (BYON retired)
        }
        $orgId = WhatsAppSender::where(['phone' => $from, 'channel_phone_number_id' => $pnid])->value('organization_id');
        $conn = $orgId ? WhatsAppConnection::where(['organization_id' => $orgId, 'mode' => 'all_in'])->first() : null;

        $token = $conn ? WhatsAppService::tokenFor($conn) : (string) config('services.meta.token');

        if (! $conn || $conn->status !== 'connected' || ! $conn->organization->isPro()) {
            // Paid message to an unknown/unsubscribed sender: at most once a day per number.
            if (Cache::add("wa-unlinked:$from", 1, now()->addDay())) {
                WhatsAppService::sendText($pnid, $from, $conn
                    ? '🐷 WhatsApp untuk '.$conn->organization->name.' butuh paket Pro. Aktifkan di menu Penagihan.'
                    : '🐷 Nomor kamu belum terhubung ke PiggyBang!. Buka menu WhatsApp di dashboard untuk menghubungkan.', $token);
            }

            return;
        }
        $org = $conn->organization;
        if (! RateLimiter::attempt('wa-org:'.$org->id, 30, fn () => true, 60)) {
            return; // 30 msg/min/org — drop silently
        }

        $sender = WhatsAppSender::firstOrCreate(['phone' => $from, 'channel_phone_number_id' => $pnid], ['organization_id' => $org->id]);
        $sender->update(['last_message_at' => now()]);
        $conn->update(['last_webhook_at' => now()]);
        $user = $sender->user_id ? User::find($sender->user_id) : null;
        $membership = $user?->membershipFor($org);
        if ($user && ! $membership) { // removed from the team since linking
            $sender->delete();
            WhatsAppService::sendText($pnid, $from, "🐷 Kamu sudah tidak terdaftar di {$org->name}. Hubungkan ulang dari dashboard.", $token);

            return;
        }

        // Cost model: reactions are free, text costs money (capped per plan, see Organization::botQuota).
        $react = fn (string $emoji) => rescue(fn () => WhatsAppService::react($pnid, $from, $this->msg['id'], $emoji, $token));
        $say = fn (string $body, string $fallback) => WhatsAppService::sendCapped($conn, $from, $body) || $react($fallback);

        if ($this->msg['type'] === 'image' && $this->msg['media_id']) {
            [$path, $mime] = WhatsAppService::downloadMedia($this->msg['media_id'], $token);
            $ocr = OcrService::extract($path, $mime);
            @unlink($path);
            $text = trim("Struk: {$ocr['description']}, total {$ocr['amount']}".($ocr['date'] ? ", tanggal {$ocr['date']}" : '')."\n".$text);
        }
        if ($text === '') {
            return;
        }
        if (! AiClient::configured()) {
            $say('🐷 Ups, AI sedang tidak tersedia. Coba lagi nanti ya.', '⚠️');

            return;
        }

        $output = AiClient::json($this->prompt($org, $user, $this->msg['name'] ?? null, $text));
        $output['entries'] ??= [];
        $v = Validator::make($output, EntryIngestionService::rules('') + WhatsAppAssistant::rules());
        if ($v->fails()) {
            Log::warning('WA extraction invalid', ['errors' => $v->errors()->all(), 'output' => $output]);
            $say('🐷 Maaf, aku belum paham. Coba tulis seperti: "makan siang 25000".', '❓');

            return;
        }
        if (($output['intent'] ?? null) === 'ask' && ! empty($output['ask']['topic'])) {
            $say(WhatsAppAssistant::answer($org, $user, $membership, $output['ask']), '🔒'); // 🔒 = reply quota used up

            return;
        }
        if (! $output['entries']) {
            $say('🐷 '.($output['clarification_question'] ?? 'Mau catat transaksi atau cek sesuatu? Ketik "bantuan" untuk contoh.'), '❓');

            return;
        }
        if ($membership && ! $membership->can('transactions.write')) {
            $say('🐷 Peran kamu di '.$org->name.' hanya bisa melihat. Minta admin mengubah peranmu untuk mencatat transaksi.', '🔒');

            return;
        }

        $result = EntryIngestionService::ingest($org, $output['entries'], $user);
        // Text only when it tells the user something: remaining budget for budgets with "notify" on, bill/payday
        // reminders (once a day per team), or a question. Otherwise the free ✅ reaction is the receipt.
        $budget = WhatsAppService::budgetLines($org, $result['transactions']);
        $reminders = $result['metadata']['reminders'] && Cache::add("wa-remind:{$org->id}:".now($org->timezone())->toDateString(), 1, now()->addDay())
            ? $result['metadata']['reminders'] : [];
        $question = ! empty($output['needs_clarification']) ? ($output['clarification_question'] ?? null) : null;
        if (! $budget && ! $reminders && ! $question) {
            $react('✅');

            return;
        }
        $body = WhatsAppService::formatReply($org, $result['transactions'], $budget, $reminders);
        if (! $say($question ? $body."\n\n❓ ".$question : $body, '✅') && $reminders) {
            Cache::forget("wa-remind:{$org->id}:".now($org->timezone())->toDateString()); // not delivered: try next time
        }
    }

    private function pair(string $code, string $pnid, string $from): void
    {
        // Personal code from WhatsAppService::startAllIn: links this phone to that member of that team.
        $pending = Cache::pull("wa-pair:$code");
        $conn = $pending ? WhatsAppConnection::where(['organization_id' => $pending['organization_id'], 'mode' => 'all_in'])->first() : null;
        if (! $conn) {
            WhatsAppService::sendText($pnid, $from, '🐷 Kode tidak valid atau kedaluwarsa. Buat kode baru di dashboard.');

            return;
        }
        WhatsAppSender::updateOrCreate(['phone' => $from, 'channel_phone_number_id' => $pnid], [
            'organization_id' => $conn->organization_id, 'user_id' => $pending['user_id'], 'last_message_at' => now(),
        ]);
        $conn->update(['status' => 'connected', 'connected_at' => $conn->connected_at ?? now()]);
        $conn->increment('monthly_conversations'); // the pairing reply is a paid text
        $name = User::find($pending['user_id'])?->name;
        WhatsAppService::sendText($pnid, $from, "🎉 Halo {$name}! WhatsApp kamu terhubung ke *{$conn->organization->name}*.\n\n"
            ."✍️ Catat: \"makan siang 25rb\"\n📊 Tanya: \"pengeluaranku minggu ini\", \"sisa anggaran\", \"tagihan\"\nKetik \"bantuan\" untuk lihat semua.");
    }

    private function prompt(Organization $org, ?User $user, ?string $senderName, string $text): array
    {
        $cats = $org->categories()->orderBy('type')->orderBy('sort_order')->get(['id', 'type', 'name'])
            ->map(fn ($c) => "{$c->id}|{$c->type}|{$c->name}")->implode("\n");
        $members = $org->memberships()->whereNotNull('user_id')->with('user')->get()->pluck('user.name')->implode(', ');
        $aiBudgets = BudgetService::aiRules($org, 'expense')->concat(BudgetService::aiRules($org, 'income'));
        $budgets = $aiBudgets->isEmpty() ? '' : "\n".BudgetService::aiPrompt($aiBudgets);
        $budgetField = $aiBudgets->isEmpty() ? '' : ',"budget_id":number|null';
        $now = now($org->timezone());
        [$cycleStart, $cycleEnd] = PaydayService::cycle($org);
        $actor = $user?->name ?? $senderName ?? 'Unknown';
        // Models are unreliable at calendar math: hand them the exact ranges.
        $d = fn ($a, $b = null) => $a->toDateString().'..'.($b ?? $a)->toDateString();
        $week = $now->copy()->startOfWeek();
        $ranges = implode(', ', [
            'today='.$d($now), 'yesterday='.$d($now->copy()->subDay()), 'this week='.$d($week, $now),
            'last week='.$d($week->copy()->subWeek(), $week->copy()->subDay()), 'this month='.$d($now->copy()->startOfMonth(), $now),
            'last month='.$d($now->copy()->subMonthNoOverflow()->startOfMonth(), $now->copy()->subMonthNoOverflow()->endOfMonth()),
            'this year='.$d($now->copy()->startOfYear(), $now), 'current payday cycle='.$d($cycleStart, $cycleEnd),
        ]);

        return [
            ['role' => 'system', 'content' => <<<PROMPT
You are Piggy, the WhatsApp assistant of a family finance app. Classify each message and reply ONLY JSON.
Now: {$now->toIso8601String()} ({$now->locale('id')->dayName}, timezone {$org->timezone()}). Default currency: {$org->currency()}.
Sender: {$actor}. Team members: {$members}.
Date ranges (copy exactly into from/to): {$ranges}.
VALID_CATEGORIES (id|type|name):
{$cats}{$budgets}

intent "record": the message reports money spent or received. Fill entries.
- "25k"/"25rb" = 25000, "1,5jt"/"1.5jt" = 1500000. Expense unless clearly income (gaji, gajian, salary, transfer masuk, bonus).
- Pick the closest category from VALID_CATEGORIES (id and name). Fuel/parking/ojek/toll → transport-like category; electricity/phone credit/internet/subscriptions → bills-like category.
- One entry per item ("bensin 100k sama parkir 5rb" = 2 entries). Relative dates ("kemarin") against Now.
- description: the sender's own words for that item, copied exactly, minus the amount and date words ("kemarin bensin mobil 100k" → "bensin mobil"). Never translate, rephrase, or replace it with the category name.intent "ask": the message asks about their data (berapa, sisa, cek, lihat, tampilkan, rekap, "?"). Fill ask:
- topic: transactions (spending/income/history/totals) | budgets (anggaran, jatah, limit, sisa) | bills (tagihan) | savings (tabungan) | categories | billing (paket, langganan, kuota, bayar) | members (anggota) | help (bisa apa, cara pakai).
- scope: "me" when about the sender (aku, saya, -ku, punyaku), else "team".
- type: expense | income | all. category/keyword/member: only if mentioned (member must be one of Team members).
- from/to: copy the matching range above for hari ini / kemarin / minggu ini / minggu lalu / bulan ini / bulan lalu / tahun ini, or a specific date mentioned; null = current payday cycle.
- For budgets/bills, put the item mentioned ("makan", "listrik") in keyword.
intent "other": greetings or anything else: no entries, ask a short friendly Indonesian question about what to record or check.
If a record is ambiguous (no amount), use needs_clarification with a short Indonesian question.

JSON: {"intent":"record|ask|other","entries":[{"type":"income|expense","category":{"id":number,"name":string},"description":string,"value":{"amount":number,"currency":"IDR"},"actor":{"name":string},"datetime":ISO8601,"source":"whatsapp","confidence":0..1{$budgetField}}],"ask":{"topic":string,"scope":"me|team","type":"expense|income|all","category":string|null,"keyword":string|null,"member":string|null,"from":string|null,"to":string|null}|null,"needs_clarification":bool,"clarification_question":string|null}
PROMPT],
            ['role' => 'user', 'content' => $text],
        ];
    }
}
