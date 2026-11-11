<?php

namespace App\Services;

use App\Models\Membership;
use App\Models\Organization;
use App\Models\PushSubscription;
use App\Models\Transaction;
use App\Models\User;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

/** Web Push to browsers / installed PWAs. Does nothing until VAPID keys are set (`php artisan push:keys`). */
class PushService
{
    /** Tests set this to [] to capture [user_id, payload] instead of sending. */
    public static ?array $fake = null;

    /** @param array{title: string, body: string, url?: string, tag?: string} $payload */
    public static function send(array $userIds, array $payload): void
    {
        if (self::$fake !== null) {
            foreach ($userIds as $id) {
                self::$fake[] = [$id, $payload];
            }

            return;
        }
        $vapid = config('services.webpush');
        $subs = $vapid['public_key'] && $vapid['private_key'] ? PushSubscription::whereIn('user_id', $userIds)->get() : collect();
        if ($subs->isEmpty()) {
            return;
        }
        $push = new WebPush(['VAPID' => ['subject' => $vapid['subject'], 'publicKey' => $vapid['public_key'], 'privateKey' => $vapid['private_key']]], logger: logger()->driver()); // logger: without GMP/BCMath the library raises a notice, which Laravel would turn into an exception
        foreach ($subs as $s) {
            $push->queueNotification(Subscription::create(['endpoint' => $s->endpoint, 'keys' => ['p256dh' => $s->p256dh, 'auth' => $s->auth]]), json_encode($payload), ['TTL' => 43200]);
        }
        foreach ($push->flush() as $report) {
            if ($report->isSubscriptionExpired()) { // browser unsubscribed or app removed
                PushSubscription::where('endpoint', $report->getEndpoint())->delete();
            } elseif (! $report->isSuccess()) {
                logger()->warning('Push failed: '.$report->getReason());
            }
        }
    }

    /** 19:00: users with a device registered who recorded nothing today (web or WhatsApp, any team). */
    public static function nudgeIdleUsers(): void
    {
        // ponytail: "today" and 19:00 are Asia/Jakarta for everyone; per-user timezone if WITA/WIT users complain.
        $subscribed = PushSubscription::distinct()->pluck('user_id');
        $active = Transaction::whereIn('user_id', $subscribed)->where('created_at', '>=', now('Asia/Jakarta')->startOfDay())->distinct()->pluck('user_id');
        foreach (User::whereIn('id', $subscribed->diff($active))->get()->groupBy(fn (User $u) => $u->locale === 'en' ? 'en' : 'id') as $locale => $users) {
            self::send($users->pluck('id')->all(), [
                'title' => $locale === 'en' ? 'Nothing recorded today 🐷' : 'Belum ada catatan hari ini 🐷',
                'body' => $locale === 'en' ? 'Spent or earned anything? Record it before you forget.' : 'Ada pengeluaran atau pemasukan? Catat dulu sebelum lupa.',
                'url' => '/app/transactions', 'tag' => 'daily-nudge',
            ]);
        }
    }

    /** Daily: one push per bill due within 3 days (or overdue) and for payday from D-3, to every member of the team. */
    public static function sendReminders(): void
    {
        $subscribed = PushSubscription::distinct()->pluck('user_id');
        $members = Membership::whereIn('user_id', $subscribed)->get()->groupBy('organization_id');
        foreach (Organization::whereIn('id', $members->keys())->get() as $org) {
            if ($org->isLocked()) {
                continue;
            }
            foreach (ReminderService::reminders($org, 3) as $r) {
                $d = $r['days_until'];
                $when = $d < 0 ? 'terlambat '.abs($d).' hari' : ($d === 0 ? 'hari ini' : "$d hari lagi");
                self::send($members[$org->id]->pluck('user_id')->all(), $r['kind'] === 'bill'
                    ? ['title' => "📋 Tagihan {$r['name']}: $when", 'body' => WhatsAppService::rupiah($r['amount'])." · {$org->name}", 'url' => '/app/bills', 'tag' => "bill-{$org->id}-{$r['name']}"]
                    : ['title' => "💰 Gajian $when", 'body' => "{$r['name']} · {$org->name}", 'url' => '/app/dashboard', 'tag' => "payday-{$org->id}"]);
            }
        }
    }
}
