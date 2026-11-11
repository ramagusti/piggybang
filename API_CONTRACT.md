# Piggybang API Contract (v2)

Base URL: `${NEXT_PUBLIC_API_URL}` (default `http://localhost:8000/api`).
Auth: `Authorization: Bearer <token>` (Sanctum personal access token, returned by login/register).
All bodies JSON unless noted. Money values are decimal **strings** (`"25000.00"`). Datetimes ISO 8601.

Errors:
- `401 {message}` unauthenticated
- `403 {message}` not a member / role lacks permission / feature needs Pro (`code: "pro_required"`)
- `422 {message, errors?, code?}` validation. Plan limits use `code: "plan_limit"`, message in Indonesian (e.g. `"Batas anggota Free tercapai. Upgrade ke Pro."`).
- `429` rate limited

Pagination (list endpoints marked *paginated*): `{ data: [...], meta: { current_page, last_page, per_page, total } }`.

## Objects

```ts
User { id, name, email, avatar_url, locale: 'id'|'en', timezone, email_verified_at }
Organization {
  id, name, slug, plan: 'free'|'pro', effective_plan: 'free'|'pro', locked: boolean,   // effective = pro while trialing
  is_trialing: boolean, trial_ends_at, member_limit, whatsapp_mode: null|'byon'|'all_in',
  settings: { timezone, currency, date_format, onboarded: boolean, webhook_url? },
  role: 'owner'|'admin'|'member'|'viewer',            // current user's role
  permissions: string[],                               // see Roles below
  limits: { categories_per_type: number|null, members: number },
  usage: { members, expense_categories, income_categories }
}
Category { id, type: 'income'|'expense', name, icon, color, sort_order, is_system, transactions_count }
Transaction {
  id, type, amount, currency, description, actor, transaction_time,
  category: {id,name,icon,color}|null, user: {id,name}|null,
  proof_url, source: 'web'|'whatsapp'|'api'|'import', confidence, split: {group, part, of, total}|null, created_at
}
Rule {
  id, name, type: 'weekly_limit'|'monthly_limit'|'payday', category_id, category: {id,name,icon,color}|null,
  limit_amount, period, is_primary_payday, date_condition, category_name, rollover_enabled, notify /*WhatsApp "sisa jatah" reply*/,
  progress?: { period_start, period_end, spent, base_limit, carryover, effective_limit, remaining, percent }, // limits only
  cycle?: { start, end }                                                                                 // payday only
}
Savings { cycle_start, cycle_end, income_total, expense_total, net_savings }
SavingsCurrent = Savings & { previous_net: string|null, trend: 'improving'|'worsening'|'flat', progress_pct: number } // progress_pct = expense/income*100
Bill {
  id, name, amount, currency, due_date, recurrence: 'monthly'|'quarterly'|'yearly'|'one_time',
  category_id, category: {id,name,icon,color}|null, created_by: {id,name}|null /*who added it*/,
  destination_account, destination_number, is_active, last_paid_at,
  days_until_due: number, status: 'overdue'|'due_soon'|'upcoming'|'normal'|'paid'   // due_soon ≤3d, upcoming ≤7d
}
Member { id /*membership id*/, user: {id,name,email,avatar_url}|null, email, role, pending: boolean, joined_at, invitation_accepted_at }
BudgetWarning { rule_id, name, spent, effective_limit, remaining, percent, level: 'near'|'exceeded' }
Reminder { kind: 'bill'|'payday', name, amount, days_until, date }
```

Roles → permissions:
| permission | owner | admin | member | viewer |
|---|---|---|---|---|
| transactions.view | ✓ | ✓ | ✓ | ✓ |
| transactions.write | ✓ | ✓ | ✓ | |
| categories.write | ✓ | ✓ | ✓ | |
| rules.write | ✓ | ✓ | | |
| bills.write | ✓ | ✓ | ✓ | |
| members.manage | ✓ | ✓ | | |
| whatsapp.manage | ✓ | ✓ | | |
| billing.manage | ✓ | | | |
| organization.delete | ✓ | | | |

## Auth
| Method | Path | Body | Response |
|---|---|---|---|
| POST | /auth/register | name, email, password, organization_name, invitation_token? | `{user, token, organization}` |
| POST | /auth/login | email, password, remember? | `{user, token}` |
| POST | /auth/logout | | 204 |
| POST | /auth/forgot-password | email | `{message}` |
| POST | /auth/reset-password | token, email, password, password_confirmation | `{message}` |
| GET | /auth/verify-email/{id}/{hash} (signed) | | redirect `FRONTEND_URL/verified` |
| POST | /auth/verify-email/resend | | `{message}` |
| GET | /user | | `{user, organizations: Organization[]}` |
| PATCH | /user | name?, locale?, timezone?, avatar_url? | `{user}` |
| GET | /push/key | | `{key}` VAPID public key (null if push is not configured) |
| POST | /push/subscriptions | `PushSubscription.toJSON()`: endpoint, keys.p256dh, keys.auth | 204. Registers this device for Web Push (19:00 "nothing recorded today" nudge; 08:00 bills due ≤3 days and payday from D-3). Endpoint must be a browser push service |
| DELETE | /push/subscriptions | endpoint | 204 |

## Organizations
| Method | Path | Notes |
|---|---|---|
| GET | /organizations | `Organization[]` |
| POST | /organizations | name, slug? → Organization. First owned team: free with a 3-day Pro trial. Further teams: `locked: true` until paid; every other org endpoint returns 402 `{code:'team_payment_required'}` except GET/DELETE org, switch and subscription/* |
| GET | /organizations/{org} | Organization (`{org}` = id) |
| PATCH | /organizations/{org} | name?, slug?, settings? (merged) |
| DELETE | /organizations/{org} | owner only |
| POST | /organizations/{org}/switch | 204 (remembers last org for user) |
| POST | /organizations/{org}/onboarding | `{categories?: {type,name}[], budgets?: {name, category_id?, limit_amount}[], payday_day?: number}` → Organization (onboarded=true) |
| GET | /organizations/{org}/dashboard?period=week\|month\|year | `{kpi:{savings, income, expense, income_change_pct, expense_change_pct, savings_progress_pct}, recent_transactions: Transaction[5], budget_warnings: BudgetWarning[], upcoming_bills: Bill[], expense_by_category: {category_id,name,color,total}[], transactions_total: number}` |
| GET | /organizations/{org}/realtime-token | `{url, anon_key, schema, token, expires_at}` or 204 if Supabase not configured. Subscribe to postgres_changes in `schema` on `transactions`/`savings`/`bills` filtered `organization_id=eq.{org}` |

## Members
| GET | /organizations/{org}/members | `Member[]` |
| POST | /organizations/{org}/invite | email, role ('admin'\|'member'\|'viewer') → Member (pending). 422 plan_limit at cap; admin/viewer need Pro |
| GET | /invitations/{token} | public → `{organization: {id,name}, email, role}` |
| POST | /organizations/{org}/join/{token} | auth'd user accepts → Organization |
| PATCH | /organizations/{org}/members/{user} | role. `{user}` = user id; for pending invites use the membership id + `?pending=1` |
| DELETE | /organizations/{org}/members/{user} | 204 (owner cannot be removed); same `?pending=1` rule |

## Categories
| GET | /organizations/{org}/categories?type= | `Category[]` sorted by sort_order |
| POST | /organizations/{org}/categories | type, name, icon?, color? (422 plan_limit at 15/type on Free) |
| PATCH | /organizations/{org}/categories/{cat} | name?, icon?, color? |
| DELETE | /organizations/{org}/categories/{cat}?move_to={id} | 422 `{code:'has_transactions', transactions_count}` if used and no move_to; system categories 422 |
| POST | /organizations/{org}/categories/reorder | `{ids: number[]}` → 204 |

## Rules (budgets & payday)
| GET | /organizations/{org}/rules?type= | `Rule[]` with progress/cycle |
| POST | /organizations/{org}/rules | name, type, limit_amount, category_id?, period?, is_primary_payday?, date_condition?, category_name?, rollover_enabled? |
| PATCH/DELETE | /organizations/{org}/rules/{rule} | |

## Transactions
| GET | /organizations/{org}/transactions | *paginated*; query: type, category_id, user_id, q, from, to (dates), page, per_page (≤100) |
| POST | /organizations/{org}/transactions | type, category_id, amount, currency?, description?, actor?, transaction_time, proof? (multipart image) → `{transaction, metadata:{budget_warnings, savings}}` |
| GET/PATCH/DELETE | /organizations/{org}/transactions/{tx} | PATCH same fields as POST |
| POST | /organizations/{org}/transactions/split | Split bill: same fields as POST (amount = total, no category_id) + `splits: {amount, category_id, actor?}[]` (2–20, must sum to amount; multipart ok). Atomic → `{transactions: Transaction[], metadata}`; each has `split: {group, part, of, total}` |
| POST | /organizations/{org}/transactions/import | multipart `file` CSV header `date,type,category,amount,currency,description,actor` → `{imported, errors: {row, message}[]}` |

## Savings / Bills
| GET | /organizations/{org}/savings | SavingsCurrent |
| GET | /organizations/{org}/savings/history | `Savings[]` newest first |
| GET/POST | /organizations/{org}/bills | `Bill[]` sorted by due_date / create. No category_id → guessed from the name (AI over the team's expense categories, else the bills-like category) |
| PATCH/DELETE | /organizations/{org}/bills/{bill} | |
| POST | /organizations/{org}/bills/{bill}/pay | creates expense transaction, advances due_date if recurring → `{bill, transaction}` |

## Export / OCR
| GET | /organizations/{org}/export/transactions?format=csv\|pdf&from&to | file download |
| GET | /organizations/{org}/export/savings?format=csv\|pdf | file download |
| POST | /organizations/{org}/ocr/receipt | multipart `image` → `{amount, description, date, source:'tesseract'|'ai'}` |

## WhatsApp (whatsapp.manage; included in Pro incl. trial; shared Piggybang number only)
| GET | /organizations/{org}/whatsapp | `{connection: {mode, phone_number, status, connected_at, monthly_conversations /*paid texts this month*/, conversation_limit /*60*/, linked_senders: string[]}|null, platform_number}` |
| POST | /organizations/{org}/whatsapp/byon/* | 410 (retired) |
| POST | /organizations/{org}/whatsapp/all-in/start | → `{pairing_code, wa_link, expires_at}`; render `wa_link` as QR. User sends the code from their WhatsApp; connection becomes `connected` |
| POST | /organizations/{org}/whatsapp/disconnect | 204 |
| POST | /organizations/{org}/whatsapp/test | `{message}` |

## Subscription (billing.manage)
| GET | /organizations/{org}/subscription | `{plan, effective_plan, tier, bot_quota, bot_used, bot_packs, deferred_addon_total, status, provider, interval, extra_seats, whatsapp_mode, current_period_start, current_period_end, cancel_at_period_end, trial_ends_at, monthly_total, invoices: {date, description, amount, status, url}[]}` |
| POST | /organizations/{org}/subscription/checkout | plan:'pro', tier:'pro'\|'plus'\|'max', interval:'monthly'\|'yearly', extra_seats?, bot_packs? (+50 replies, Rp 30k/mo each), provider?:'xendit' → `{url}` redirect, or `{url:null}` when applied with nothing to pay. Same tier+interval on an active plan = add-on change: increases are charged pro rata: under Rp 25k they apply now and join the next renewal invoice (`url:null`, see `deferred_addon_total`); from Rp 25k, or when cancelling, invoiced now and applied on payment; decreases apply immediately (no refund; seats can't drop below members). Pro 55k/mo or 500k/yr with 50 replies, Plus 110k or 1jt with 150, Max 220k or 2jt with 350; seat 15k (+10 replies); yearly = 10× |
| POST | /organizations/{org}/subscription/portal | → `{url}` (Stripe portal; Xendit returns latest invoice URL) |
| POST | /organizations/{org}/subscription/cancel | → subscription (cancel_at_period_end=true) |

## API tokens (Pro)
| GET/POST | /organizations/{org}/api-tokens | POST name → `{id, name, token}` (token shown once) |
| DELETE | /organizations/{org}/api-tokens/{id} | |

## Machine endpoints
- `POST /entries/ingest` — WhatsApp bridge. Headers `X-Organization-ID`, `X-User-ID`, `X-Webhook-Signature: hex(hmac_sha256(raw_body, INGEST_SECRET))`. Body per backend spec §5.3 → `{transactions, metadata:{budget_warnings, reminders, savings}}`.
- `GET|POST /webhooks/whatsapp` — Meta webhook (platform app).
- `POST /webhooks/stripe`, `POST /webhooks/xendit`.
