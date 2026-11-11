<?php

use App\Jobs\AssignBudget;
use App\Models\Bill;
use App\Models\Organization;
use App\Models\Transaction;
use App\Models\User;
use App\Models\WhatsAppConnection;
use App\Notifications\BillDue;
use App\Services\BillingService;
use App\Services\BudgetService;
use App\Services\PushService;
use App\Services\SavingsService;
use App\Services\WhatsAppService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Str;
use Minishlink\WebPush\VAPID;

// Spec §8. Run `php artisan schedule:work` (dev) or cron `* * * * * php artisan schedule:run` (prod).

Schedule::call(function () { // SendBillReminders: due in ≤3 days (or overdue), once per day per bill
    Bill::where('is_active', true)->whereDate('due_date', '<=', now()->addDays(3))
        ->where(fn ($q) => $q->whereNull('last_notified_at')->orWhere('last_notified_at', '<', now()->startOfDay()))
        ->each(function (Bill $bill) {
            $org = Organization::find($bill->organization_id);
            $admins = $org->memberships()->whereIn('role', ['owner', 'admin'])->whereNotNull('user_id')->with('user')->get()->pluck('user');
            Notification::send($admins, new BillDue($bill));
            $d = $bill->daysUntilDue();
            WhatsAppService::notifyOrganization($org, "📋 *Pengingat tagihan:* {$bill->name} ".WhatsAppService::rupiah($bill->amount).' — '.($d <= 0 ? 'jatuh tempo hari ini' : "$d hari lagi").($bill->destination_number ? "\nVia: {$bill->destination_account} {$bill->destination_number}" : ''));
            $bill->update(['last_notified_at' => now()]);
        });
})->dailyAt('06:00')->timezone('Asia/Jakarta')->name('SendBillReminders')->withoutOverlapping();

Schedule::call(fn () => Organization::query()->each(fn ($org) => SavingsService::recordForOrganization($org)))
    ->dailyAt('07:00')->timezone('Asia/Jakarta')->name('RecalculateAllSavings')->withoutOverlapping();

Schedule::call(function () { // WeeklyBudgetSummary (Mon 00:00)
    Organization::whereNotNull('whatsapp_mode')->each(function (Organization $org) {
        $s = SavingsService::current($org);
        $lines = ['🐷 *Ringkasan minggu ini — '.$org->name.'*'];
        foreach ($org->rules()->where('type', 'weekly_limit')->get() as $rule) {
            $p = BudgetService::progress($org, $rule, now()->subDay()); // the week that just ended
            $lines[] = ($p['percent'] > 100 ? '🔴' : '🟢')." {$rule->name}: ".WhatsAppService::rupiah($p['spent']).' / '.WhatsAppService::rupiah($p['effective_limit']);
        }
        $lines[] = ((float) $s['net_savings'] < 0 ? '🔴' : '🟢').' Tabungan siklus ini: '.WhatsAppService::rupiah($s['net_savings']);
        WhatsAppService::notifyOrganization($org, implode("\n", $lines));
    });
})->weeklyOn(1, '00:00')->timezone('Asia/Jakarta')->name('WeeklyBudgetSummary')->withoutOverlapping();

Schedule::call(function () { // CleanupSoftDeletes (+ optional Free-tier 2-year retention)
    Transaction::onlyTrashed()->where('deleted_at', '<', now()->subDays(30))->forceDelete();
    if (! config('services.retention.free_years_enabled')) {
        return; // Hard-deleting history is opt-in only (FREE_RETENTION_ENABLED=true).
    }
    Organization::where('plan', 'free')->each(function (Organization $org) {
        if (! $org->isPro()) {
            $org->transactions()->withTrashed()->where('transaction_time', '<', now()->subYears(2))->forceDelete();
        }
    });
})->dailyAt('02:00')->timezone('Asia/Jakarta')->name('CleanupSoftDeletes')->withoutOverlapping();

Schedule::call(fn () => BillingService::runXenditLifecycle())->dailyAt('08:00')->timezone('Asia/Jakarta')->name('XenditLifecycle')->withoutOverlapping();
Schedule::call(fn () => WhatsAppConnection::query()->update(['monthly_conversations' => 0])) // monthly paid-text cap
    ->monthlyOn(1, '00:00')->timezone('Asia/Jakarta')->name('ResetWhatsAppTextCap');

// Push notifications to phones/browsers that enabled them (Settings → Profile).
Schedule::call(fn () => PushService::sendReminders())->dailyAt('08:00')->timezone('Asia/Jakarta')->name('PushReminders')->withoutOverlapping();
Schedule::call(fn () => PushService::nudgeIdleUsers())->dailyAt('19:00')->timezone('Asia/Jakarta')->name('PushDailyNudge')->withoutOverlapping();

Artisan::command('push:keys', function () {
    $k = VAPID::createVapidKeys();
    $this->line("VAPID_PUBLIC_KEY={$k['publicKey']}\nVAPID_PRIVATE_KEY={$k['privateKey']}\nVAPID_SUBJECT=mailto:you@example.com");
})->purpose('Print new Web Push keys for .env (run once; changing them invalidates every subscription)');

Artisan::command('budgets:assign {org? : team id; default all teams with AI rules}', function (?string $org = null) {
    $orgs = Organization::whereHas('rules', fn ($q) => $q->where('ai_assign', true))->when($org, fn ($q) => $q->whereKey($org))->get();
    foreach ($orgs as $o) {
        foreach (AssignBudget::cycleBatches($o) as $i => $ids) { // runs here, not on the queue, so you see what the AI did
            $s = (new AssignBudget($o->id, $ids))->handle();
            $this->line("{$o->name} batch ".($i + 1).': '.count($ids)." transactions, {$s['sent']} sent to the AI → {$s['picked']} filed, {$s['none']} in no rule"
                .($s['sent'] > $s['picked'] + $s['none'] ? ' (unusable AI answer: see storage/logs/laravel.log)' : ''));
        }
    }
})->purpose("Let the AI (re)file this cycle's transactions into AI budgets and payday rules, and show the result");

Artisan::command('plan:grant {org : team id} {tier=max : pro|plus|max} {--months=1}', function (string $org, string $tier) {
    if (! config("billing.tiers.$tier")) {
        $this->error("Unknown tier '$tier'. Use: ".implode(', ', array_keys(config('billing.tiers'))));

        return 1;
    }
    $team = Organization::findOrFail($org);
    $team->subscriptions()->whereIn('status', ['active', 'past_due', 'trialing'])->update(['status' => 'canceled']);
    $sub = $team->subscriptions()->create([
        'provider' => 'manual', 'provider_subscription_id' => 'manual-'.Str::uuid(), 'provider_customer_id' => 'manual',
        'plan' => 'pro', 'tier' => $tier, 'interval' => 'monthly', 'status' => 'active',
        'current_period_start' => now(), 'current_period_end' => now()->addMonths((int) $this->option('months')),
    ]);
    BillingService::sync($sub);
    $this->info("{$team->name}: ".config("billing.tiers.$tier.name")." until {$sub->current_period_end->toDateString()} (bot replies: {$team->fresh()->bot_quota}).");
})->purpose('Give a team a paid tier without payment (expires by itself after --months)');

Artisan::command('push:test {email}', function (string $email) {
    $user = User::where('email', $email)->firstOrFail();
    PushService::send([$user->id], ['title' => 'PiggyBang! 🐷', 'body' => 'Notifikasi aktif.', 'url' => '/app/dashboard', 'tag' => 'test']);
    $this->info('Sent to '.$user->pushSubscriptions()->count().' device(s).');
})->purpose('Send a test push notification to one user');
