<?php

namespace App\Services;

use App\Models\Organization;
use App\Models\User;
use App\Models\WhatsAppConnection;
use App\Models\WhatsAppSender;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Meta WhatsApp Cloud API client.
 * BYON: the customer's number is added to the platform WABA (META_WABA_ID), verified by SMS OTP and registered.
 * All-In: customers message the shared platform number; a pairing code links their WhatsApp to the org.
 */
class WhatsAppService
{
    public const PAIRING_TTL_MINUTES = 15;

    private static function graph(?string $token = null)
    {
        return Http::baseUrl('https://graph.facebook.com/'.config('services.meta.graph_version'))
            ->withToken($token ?? config('services.meta.token'))->timeout(20);
    }

    private static function call(callable $fn): array
    {
        try {
            return $fn()->throw()->json() ?? [];
        } catch (RequestException $e) {
            $msg = $e->response->json('error.error_user_msg') ?? $e->response->json('error.message') ?? 'Meta API error';
            $code = preg_match('/already|registered|in use|exists/i', $msg) ? 'number_in_use' : 'meta_error';
            $ex = ValidationException::withMessages(['phone_number' => [$msg]]);
            $ex->response = response()->json(['message' => $msg, 'code' => $code], 422);
            throw $ex;
        }
    }

    /** $countryCode defaults to 62 (Indonesia); pass it for other countries since E.164 cc length varies. */
    public static function startByon(Organization $org, string $e164, string $countryCode = '62'): WhatsAppConnection
    {
        $digits = ltrim($e164, '+');
        abort_unless(str_starts_with($digits, $countryCode), 422, 'Kode negara tidak cocok dengan nomor.');
        $phone = self::call(fn () => self::graph()->post(config('services.meta.waba_id').'/phone_numbers', [
            'cc' => $countryCode, 'phone_number' => substr($digits, strlen($countryCode)), 'verified_name' => Str::limit($org->name, 50, ''),
        ]));
        self::call(fn () => self::graph()->post($phone['id'].'/request_code', ['code_method' => 'SMS', 'language' => 'id']));

        return WhatsAppConnection::updateOrCreate(['organization_id' => $org->id], [
            'mode' => 'byon', 'phone_number' => $e164, 'phone_number_id' => $phone['id'], 'waba_id' => config('services.meta.waba_id'),
            'status' => 'verifying', 'verify_token' => Str::random(32), 'connected_at' => null,
        ]);
    }

    public static function verifyByon(WhatsAppConnection $conn, string $code): WhatsAppConnection
    {
        self::call(fn () => self::graph()->post($conn->phone_number_id.'/verify_code', ['code' => $code]));
        $pin = (string) random_int(100000, 999999);
        self::call(fn () => self::graph()->post($conn->phone_number_id.'/register', ['messaging_product' => 'whatsapp', 'pin' => $pin]));
        self::call(fn () => self::graph()->post($conn->waba_id.'/subscribed_apps')); // idempotent

        $conn->update([
            'status' => 'connected', 'connected_at' => now(), 'webhook_url' => url('/api/webhooks/whatsapp'),
            'metadata' => array_merge($conn->metadata ?? [], ['two_step_pin' => encrypt($pin)]),
            'conversation_reset_at' => now()->addMonth(),
        ]);

        return $conn;
    }

    /** Personal pairing code: whoever sends it from WhatsApp is linked as $user in $org (any member can link their phone). */
    public static function startAllIn(Organization $org, User $user): array
    {
        do {
            $code = 'PIGGY-'.random_int(100000, 999999);
        } while (Cache::has("wa-pair:$code"));
        $expires = now()->addMinutes(self::PAIRING_TTL_MINUTES);
        Cache::put("wa-pair:$code", ['organization_id' => $org->id, 'user_id' => $user->id], $expires);
        WhatsAppConnection::updateOrCreate(['organization_id' => $org->id], [
            'mode' => 'all_in', 'phone_number' => config('services.meta.platform_phone'),
            'phone_number_id' => config('services.meta.platform_phone_number_id'),
            'status' => $org->whatsappConnection?->status === 'connected' ? 'connected' : 'pending',
        ]);

        return [
            'pairing_code' => $code,
            'wa_link' => 'https://wa.me/'.ltrim((string) config('services.meta.platform_phone'), '+').'?text='.rawurlencode($code),
            'expires_at' => $expires->toIso8601String(),
        ];
    }

    public static function tokenFor(WhatsAppConnection $conn): string
    {
        return $conn->access_token_enc ?: (string) config('services.meta.token');
    }

    public static function sendText(string $phoneNumberId, string $to, string $text, ?string $token = null): void
    {
        self::graph($token)->post("$phoneNumberId/messages", [
            'messaging_product' => 'whatsapp', 'to' => $to, 'type' => 'text', 'text' => ['body' => Str::limit($text, 4000)],
        ])->throw();
    }

    /** Emoji reaction on the user's message. Not billed by Meta, so it's the default acknowledgement. */
    public static function react(string $phoneNumberId, string $to, string $messageId, string $emoji, ?string $token = null): void
    {
        self::graph($token)->post("$phoneNumberId/messages", [
            'messaging_product' => 'whatsapp', 'recipient_type' => 'individual', 'to' => $to,
            'type' => 'reaction', 'reaction' => ['message_id' => $messageId, 'emoji' => $emoji],
        ])->throw();
    }

    /**
     * Paid text within the team's monthly bot-reply quota (Organization::botQuota, set by plan tier).
     * Meta charges ~Rp 396 incl. VAT per text beyond the number's 1,000 free/month (from 2026-10-01).
     * Returns false (nothing sent) once the quota is used; the last allowed text says so.
     */
    public static function sendCapped(WhatsAppConnection $conn, string $to, string $text): bool
    {
        $quota = $conn->organization->botQuota();
        if ($conn->monthly_conversations >= $quota) {
            return false;
        }
        if ($conn->monthly_conversations + 1 === $quota) {
            $text .= "\n\n_Kuota balasan bot bulan ini habis. Transaksi tetap dicatat dan ditandai ✅._";
        }
        self::sendText($conn->phone_number_id, $to, $text, self::tokenFor($conn));
        $conn->increment('monthly_conversations');

        return true;
    }

    /** "Sisa jatah" lines for budgets with notify on that these new expenses count toward. */
    public static function budgetLines(Organization $org, iterable $transactions): array
    {
        $expenses = collect($transactions)->where('type', 'expense');
        if ($expenses->isEmpty()) {
            return [];
        }

        return $org->rules()->whereIn('type', ['weekly_limit', 'monthly_limit'])->where('notify', true)->orderBy('id')->get()
            ->filter(fn ($rule) => $expenses->contains(fn ($tx) => BudgetService::matches($rule, $tx->category_id, $tx->description)))
            ->map(function ($rule) use ($org) {
                $p = BudgetService::progress($org, $rule);
                $icon = $p['percent'] > 100 ? '🔴' : ($p['percent'] >= 80 ? '🟠' : '🟢');
                $period = $rule->type === 'weekly_limit' ? 'minggu ini' : 'siklus ini';
                $left = (float) $p['remaining'] < 0 ? 'lewat '.self::rupiah(abs((float) $p['remaining'])) : 'sisa '.self::rupiah($p['remaining']);

                return "$icon {$rule->name} $period: $left dari ".self::rupiah($p['effective_limit']);
            })->values()->all();
    }

    /**
     * Proactive message to an org's linked WhatsApp senders. Meta only allows free-form text inside the
     * 24h customer-service window; others are skipped (ponytail: add approved templates for out-of-window sends).
     */
    public static function notifyOrganization(Organization $org, string $text): int
    {
        $conn = $org->whatsappConnection;
        if ($conn?->status !== 'connected' || ! $org->isPro()) {
            return 0;
        }
        $sent = 0;
        foreach (WhatsAppSender::where('organization_id', $org->id)->where('last_message_at', '>', now()->subDay())->get() as $s) {
            rescue(fn () => self::sendCapped($conn, $s->phone, $text)) && $sent++;
        }

        return $sent;
    }

    /** Download inbound media (receipt photo) to a temp file. */
    public static function downloadMedia(string $mediaId, string $token): array
    {
        $meta = self::graph($token)->get($mediaId)->throw()->json();
        $bytes = Http::withToken($token)->timeout(30)->get($meta['url'])->throw()->body();
        $path = tempnam(sys_get_temp_dir(), 'wa');
        file_put_contents($path, $bytes);

        return [$path, $meta['mime_type'] ?? 'image/jpeg'];
    }

    // ---------- Reply formatting (Indonesian, spec §6.3) ----------

    public static function rupiah(float|string $v): string
    {
        $v = (float) $v;

        return ($v < 0 ? '-' : '').'Rp '.number_format(abs($v), 0, ',', '.');
    }

    public static function indoDateTime(Carbon $t): string
    {
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        $zone = ['Asia/Jakarta' => 'WIB', 'Asia/Makassar' => 'WITA', 'Asia/Jayapura' => 'WIT'][$t->tzName] ?? $t->format('T');

        return $t->day.' '.$months[$t->month - 1].' '.$t->year.', '.$t->format('H.i').' '.$zone;
    }

    /** One short reply: what was recorded, budget lines, then bill/payday reminders. */
    public static function formatReply(Organization $org, iterable $transactions, array $budgetLines, array $reminders): string
    {
        $lines = collect($transactions)->map(fn ($tx) => '✅ Dicatat: '.($tx->description ?: ($tx->category?->name ?? '-'))
            .' *'.self::rupiah($tx->amount).'*'.($tx->category ? " ({$tx->category->name})" : '')
            .($tx->type === 'income' ? ' 🟢' : ''))->all();
        if ($budgetLines) {
            $lines[] = implode("\n", $budgetLines);
        }
        if ($reminders) {
            $lines[] = collect($reminders)->map(fn ($r) => '💡 '.($r['kind'] === 'payday'
                ? "Gajian ({$r['name']}) ".($r['days_until'] === 0 ? 'hari ini' : "{$r['days_until']} hari lagi")
                : $r['name'].' '.($r['days_until'] < 0 ? 'telat '.abs($r['days_until']).' hari' : ($r['days_until'] === 0 ? 'jatuh tempo hari ini' : "{$r['days_until']} hari lagi")).': '.self::rupiah($r['amount'])))->implode("\n");
        }

        return implode("\n\n", $lines);
    }
}
