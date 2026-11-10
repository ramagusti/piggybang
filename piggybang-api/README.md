# Piggybang API

Laravel 13 multi-tenant API for Piggybang SaaS. Endpoint contract: [`../API_CONTRACT.md`](../API_CONTRACT.md).

## Run locally

```bash
cp .env.example .env && php artisan key:generate
touch database/database.sqlite && php artisan migrate
php artisan serve                # http://localhost:8000
php artisan queue:work           # emails, outgoing webhooks, WhatsApp messages
php artisan schedule:work        # bill reminders, savings, renewals (spec §8)
php artisan test
```

Supabase: set the `DB_*` vars (Session pooler, port 5432) and run `php artisan migrate`; on Postgres this also enables RLS on every table and adds `transactions`/`savings`/`bills` to the Realtime publication. Needs `php8.4-pgsql`.

Full stack in Docker: `docker compose up --build` from the repo root.

## Performance

Query count dominates: from Indonesia every Supabase query costs about 55 to 70 ms, plus about 200 ms to open the connection.

- Keep `CACHE_STORE=file` (or `redis` with more than one server). The rate limiter hits the cache on every request, so `database` adds 6 remote queries per call.
- Locally, run `PHP_CLI_SERVER_WORKERS=4 php artisan serve`. The frontend fires several API calls at once, and a single worker answers them one after another.
- Production: run the API in the same region as the database (Singapore), so each query takes about 1 ms. Use the **Transaction pooler** (port 6543). The Session pooler allows only 15 connections, which a few PHP workers plus queue and scheduler will exhaust. If you get prepared-statement errors in transaction mode, set `PDO::ATTR_EMULATE_PREPARES => true` in the pgsql `options`.
- `App\Support\Memo` caches the payday cycle, cycle expenses, rates and memberships per request or job. It is cleared on any write to those models. `PaydayBudgetTest::test_memoized_reads_refresh_after_writes_in_same_app` guards it.

## Layout

- `app/Http/Middleware/OrganizationAccess.php`: tenant guard (`org:<permission>[,pro]`). All tenant routes are `/organizations/{org}/…` with `scopeBindings()`, so a child id from another org returns 404.
- `app/Services/`: `PaydayService` (cycle anchoring), `BudgetService` (weekly signed rollover), `SavingsService`, `BillingService` (Stripe + Xendit), `WhatsAppService` (Meta Cloud API), `OcrService`, `EntryIngestionService`.
- `app/Jobs/ProcessWhatsAppMessage.php`: inbound WhatsApp → AI extraction → transactions → Indonesian reply.
- `routes/console.php`: scheduled jobs.

## Where this differs from the spec

- **Tenancy:** handled by org-scoped routes plus a membership middleware, not a session global scope. RLS protects the Supabase anon key / Realtime path.
- **Auth:** Bearer tokens, not Sanctum SPA cookies. This avoids cross-subdomain cookie handling. API tokens (Pro) are restricted to one org through the `org:{id}` ability.
- **WhatsApp:** handled directly in Laravel (webhook → queued job), so no Node bridge is needed. `/api/entries/ingest` stays (HMAC) for the existing bridge.
- **Plans:** per team, all prices in `config/billing.php`.
  - Free: 2 members, no WhatsApp.
  - One free team per user. Any further team a user creates is `paid_only`: locked (HTTP 402 `team_payment_required`, only billing/switch/delete work) until it has a paid plan, and again if the plan lapses. Joining other teams by invite is free.
  - Paid tiers (all features, 5 members, extra seat Rp 15k/month): Pro Rp 55k/month or Rp 500k/year with 50 bot text replies a month, Plus Rp 110k or Rp 1jt with 150, Max Rp 220k or Rp 2jt with 350 (yearly ≈ 24% cheaper; it's promoted). Each extra seat adds 10 replies.
  - Add-ons on any paid tier: extra seat Rp 15k (+10 replies), reply pack Rp 30k (+50 replies). Mid-period increases are charged pro rata (`BillingService::changeAddons`): under Rp 25k (`addon_invoice_min`) they apply at once and the charge joins the next renewal invoice; from Rp 25k, or when the team is cancelling, they're invoiced now. Cancelling bills any waiting charges at once. Reductions apply immediately, no refund.
  - ✅ reactions are unlimited on every tier.
  - Xendit invoices only offer QRIS and e-wallets (`XENDIT_PAYMENT_METHODS`). Bank transfer costs Rp 9.000 + Rp 4.000 per invoice.
  - Hidden in the UI for launch (still in the API): subdomains, outgoing webhook, API tokens (`piggybang-web/src/lib/features.ts`).
  - Trial: 3 days with 20 replies, first owned team only.
- **WhatsApp:** one shared Piggybang number only (BYON retired; its endpoints return 410). The spec's "QR / Linked Devices" isn't possible on the Cloud API. Instead the QR encodes `wa.me/<platform>?text=PIGGY-123456`. Sending that code links the sender's WhatsApp to the team.
- **WhatsApp cost control:** since 2026-10-01, Meta charges about Rp 396 (incl. VAT) per text after 1,000 free a month per number. Reactions are free.
  - A text reply goes out only when it carries information: what's left on budgets whose `notify` is on and that the transaction counts toward, bill/payday reminders due within 3 days (once a day per team), or a clarifying question. Everything else gets a ✅ reaction.
  - Texts are capped at `Organization::botQuota()` per team per month. The last allowed text says so; after that the bot falls back to reactions.
  - Unknown numbers get the "not linked" reply at most once a day.
- **Proactive WhatsApp (reminders, weekly summary):** only sent inside Meta's 24h window. Approved templates are needed for anything else.
- **Xendit:** one invoice per period, with renewals issued by the scheduler. Plan changes start a fresh period (no proration).
- **Not implemented:** Horizon, Pulse, Sentry, Scribe, and token rotation (a system-user token doesn't expire). Add each when its infrastructure exists.
