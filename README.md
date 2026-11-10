# Piggybang

Family finance tracker: log spending from the web app or by chatting with a WhatsApp bot, with shared teams, payday-based budgets, bills and savings.

| Folder | What |
|---|---|
| [`piggybang-api/`](piggybang-api/) | Laravel 13 API (PHP 8.4, Postgres/Supabase). Billing via Xendit, WhatsApp via Meta Cloud API. See its [README](piggybang-api/README.md). |
| [`piggybang-web/`](piggybang-web/) | Next.js 16 web app / PWA (React 19, Tailwind 4, Indonesian + English). |
| [`API_CONTRACT.md`](API_CONTRACT.md) | Endpoints and object shapes shared by both. |

## Run locally

```bash
# API
cd piggybang-api && cp .env.example .env && composer install && php artisan key:generate
php artisan migrate
php artisan serve           # http://localhost:8000
php artisan queue:work      # WhatsApp messages, emails
php artisan schedule:work   # reminders, renewals, monthly bot quota reset

# Web
cd piggybang-web && cp .env.example .env.local && npm install && npm run dev   # http://localhost:3000
```

Or everything in Docker: `docker compose up --build`.

Tests: `php artisan test` (API, in-memory SQLite) and `npm test` / `npm run e2e` (web).
