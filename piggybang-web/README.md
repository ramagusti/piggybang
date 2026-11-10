# Piggybang Web

Next.js (App Router) frontend for Piggybang. Specs: `02-frontend-spec.md`. API: [`../API_CONTRACT.md`](../API_CONTRACT.md).

## Run

```bash
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at the Laravel API
npm install
npm run dev                  # http://localhost:3000 (id default, /en for English)
```

## Check

```bash
npm run lint && npm run typecheck && npm test && npm run build
npx playwright install chromium && npm run e2e   # API is mocked via page.route
```

On WSL without root, Chromium may miss `libnss3`/`libnspr4`/`libgbm1`/`libasound2`. Install them (`sudo npx playwright install-deps`) or extract them with `apt-get download` + `dpkg -x` and set `LD_LIBRARY_PATH`.

## Layout

- `src/app/[locale]/(marketing)` — landing, auth, join, verified
- `src/app/[locale]/app/*` — the app (client-rendered; `AppShell` loads the org and guards auth)
- `src/hooks/api.ts` — TanStack Query hooks + `useOrgMutation` (invalidates the org subtree)
- `src/hooks/use-realtime.ts` — Supabase Realtime via `GET /organizations/{org}/realtime-token`
- `src/proxy.ts` — next-intl routing, `/app` cookie guard, `{slug}.ROOT_DOMAIN` → `pb_org_slug` cookie
- `src/i18n/messages/{id,en}.json` — every UI string

Auth: bearer token in the `pb_token` cookie (readable by the proxy for redirects; the API is the real gate).

## Docker

```bash
docker build --build-arg NEXT_PUBLIC_API_URL=https://api.piggybang.app/api --build-arg NEXT_PUBLIC_ROOT_DOMAIN=piggybang.app -t piggybang-web .
docker run -p 3000:3000 piggybang-web
```
