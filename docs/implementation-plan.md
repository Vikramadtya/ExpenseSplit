# ExpenseSplit — Implementation Plan

Goal: a fast, secure, multi-user Splitwise alternative. Web + installable PWA, Google sign-in,
per-expense currency with FX, and these extras: receipt OCR with itemized splits, real-time sync,
payment deep links, recurring bills with reminders, and better analytics, tags and UI.

The phases are ordered so each one ships on its own. Phase 0 comes first because several later
features depend on correct money math and transactional writes.

---

## Status

All eight phases are implemented and committed. Backend: unit tests + integration tests against a
real Postgres (run in CI). The UI was exercised by hand in a browser for the main flows.

| Phase | State |
|-------|-------|
| 0 Foundation | **Done**: exact-cent `Money`, split strategy registry (equal/exact/percentage/shares/itemized), atomic writes, edit recompute + optimistic locking, balances from net positions per currency, cursor pagination + search, migrations (guarded by a test), CI |
| 1 Security | **Done**: global JWT + workspace-membership guards with roles, Zod validation, helmet, rate limits, 15-min access tokens with single-use rotating refresh tokens, account export/deletion, CI dependency audit + secret scan + Dependabot. See `docs/security.md` for accepted risks |
| 2 Splitwise parity | **Done** except email invites, group archive and unregistered-member merging |
| 3 Fast UX | **Done**: idempotent writes, live sync (SSE), installable PWA, persisted query cache, lazy routes, `n` quick add. Offline writes queue only for the open session (they do not survive a reload) |
| 4 Currency & payments | **Done**: per-expense currency, cached FX rates + converted totals, UPI/PayPal/Venmo links. Not built: settling a debt in a different currency at a stated rate; historical (per-expense-date) rates |
| 5 Recurring & reminders | **Done**: crash-safe recurring rules, notifications, nudges, web push and email adapters. Push and email delivery were not tested against real providers; no weekly digest |
| 6 Receipts & itemized | **Done**: upload, background scan through a Claude vision adapter (off without `ANTHROPIC_API_KEY`), itemized split with proportional tax/tip. Scanning was not run against the real model; photos are stored on local disk |
| 7 Analytics & data | **Done**: per-currency analytics with filters, tags, categories, budgets with 80/100% alerts, CSV export, Splitwise import |
| 8 Scale & observability | **Done**: route latency metrics, load-test tooling, measured results below. Not built: Sentry, a browser end-to-end suite (Playwright), Redis-backed live events |

### Measured performance

20 concurrent users, a workspace with 10,000 expenses / 26,000 splits, local Postgres, one Node
process (`scripts/bench.mjs`). Production numbers will differ with network and database latency.

| Endpoint | p50 | p95 |
|----------|-----|-----|
| Expense list (50) / search / tag filter | 44-48 ms | 52-58 ms |
| Balances / simplified debts / friends | 25-26 ms | 29-34 ms |
| Analytics (grouped by month) | 74 ms | 83 ms |
| Pairwise debts, cached | 9 ms | 11 ms |
| Pairwise debts, uncached (first call after a change) | ~75-125 ms single request | CPU-bound: ~1 s p95 if 20 users all hit it right after a change |

Decisions that differ from the original plan are listed after the phase table in earlier revisions
of this document and in the commit history: no `member_balances` table (indexed aggregate instead),
amounts stay `numeric(12,2)` and become integer cents in `Money`, no ADJUSTMENT split type, Express
rather than Fastify, and no Row-Level Security (access is enforced and tested in the app layer).

## 1. Where the code stands today (before Phase 0)

Already in place: NestJS + Fastify, Drizzle/Postgres (Neon), Google OAuth + JWT, workspaces and
members, expenses with EQUAL/EXACT/PERCENTAGE strategies, settlements, a debt-simplification
algorithm, basic analytics, a BullMQ OCR stub, OpenTelemetry/Prometheus, and a React 19 + TanStack
frontend built from `openapi.yaml`.

Problems to fix before adding features:

| # | Issue | Where | Impact |
|---|-------|-------|--------|
| 1 | Debts assume the creditor is `created_by_id`; they ignore multiple payers and settlements | `balances.repository.ts` `getExpenseDebts` | **Wrong "who owes whom"** |
| 2 | An expense and its splits are written without a transaction | `expenses.service.ts` `create` | Half-written expenses |
| 3 | Money is handled as JS floats and `decimal` strings; there is no rounding rule | split strategies | Off-by-a-cent balances |
| 4 | Editing an expense's amount or split type does not recompute its splits | `expenses.service.ts` `update` | Wrong balances after an edit |
| 5 | The JWT is passed in the redirect URL (`?token=`) and stored in `localStorage` | `auth.controller.ts` | Token leaks through history, logs and XSS |
| 6 | `getFriendsBalances` loads **every user** in the database | `balances.service.ts` | Data exposure, O(all users) |
| 7 | `rls.sql` references a `groups` table that doesn't exist, and nothing sets `app.current_*` | `database/rls.sql` | Gives no real protection |
| 8 | Search and tag filters run in memory, with no pagination | `findAllByWorkspace` | Slow on large groups |
| 9 | Deploys run `db:push` against production | `docs/deployment.md` | Schema drift and data loss risk |
| 10 | CI doesn't run tests | `.github/workflows/ci.yml` | Regressions go unnoticed |
| 11 | Split strategies are picked with `if/else` in the service | `expenses.service.ts` | Breaks Open/Closed: every new split type edits the service |

---

## 2. Architecture principles

Keep it simple: one NestJS modular monolith, one Postgres database, and Redis for queues, pub/sub and
cache. No microservices.

**Backend layering (per module):** `controller → service (use case) → repository (interface) → Drizzle`.

| Pattern | Use |
|---------|-----|
| **Value Object** `Money { minor: bigint, currency }` | All amounts. Stored as `bigint` minor units, never floats. |
| **Strategy + Registry** | `SplitStrategy` implementations (equal, exact, percent, shares, adjustment, itemized), injected as a `Map<SplitType, SplitStrategy>`. New types need no service edits (OCP). |
| **Repository** (existing) | Keep the interface + token DI. Every method takes `workspaceId` (tenant-scoped by construction). |
| **Unit of Work** | `db.transaction(tx => …)` wraps every write use case. Repositories accept an optional `tx`. |
| **Domain Events + Transactional Outbox** | Writes insert an `outbox` row in the same transaction. A worker publishes it to Redis, which fans out to SSE, notifications and activity. |
| **Adapter** | `OcrProvider`, `FxRateProvider`, `Mailer`, `PushSender`, `PaymentLinkBuilder`: swap vendors without touching domain code (DIP). |
| **Policy objects** | `WorkspacePolicy.canEditExpense(user, expense)`: authorization lives in one place, not spread across services. |

**Frontend:** keep Feature-Sliced Design (`features/<domain>/{api,components,hooks,model}`). Server
state lives in TanStack Query and UI state in Zustand. All mutations are optimistic.

**Speed budget (targets):** API p95 < 150 ms on reads and < 250 ms on writes. Initial JS < 200 KB gzip.
Interaction-to-next-paint < 100 ms. Every create/edit appears in the UI instantly (optimistic) and
syncs within 1 s to other members (SSE).

---

## 3. Data model changes

```text
users              + default_currency, locale, timezone, payment handles (upi_vpa, paypal_me, venmo), deleted_at
workspaces         + type ENUM(GROUP, DIRECT)   -- DIRECT = 1:1 "friend" ledger, like Splitwise non-group expenses
                   + simplify_debts bool, archived_at, invite_code
workspace_members  + UNIQUE(workspace_id, user_id), left_at
invites            id, workspace_id, email?, token_hash, expires_at, accepted_by
expenses           amount_minor bigint, currency char(3), category_id, notes, receipt_id,
                   payer summary, recurring_rule_id, deleted_at (soft delete), version int (optimistic locking)
expense_splits     paid_minor bigint, owed_minor bigint, shares numeric?  + UNIQUE(expense_id, user_id)
expense_items      id, expense_id, name, amount_minor, qty          -- itemized/receipt
expense_item_assignees  item_id, user_id, shares
settlements        amount_minor, currency, method ENUM(CASH, UPI, PAYPAL, VENMO, OTHER), note, deleted_at
member_balances    workspace_id, user_id, currency, net_minor   PK(workspace_id,user_id,currency)  -- maintained in-tx
categories         id, workspace_id NULL (=global), name, icon, color
tags               id, workspace_id, name   + expense_tags(expense_id, tag_id)   -- replaces text[] for indexing
fx_rates           date, base, quote, rate   PK(date,base,quote)
recurring_rules    id, workspace_id, template jsonb, rrule text, next_run_at, active
receipts           id, workspace_id, storage_key, status, ocr_result jsonb
comments           id, expense_id, user_id, body, created_at
activity_log       id, workspace_id, actor_id, verb, entity, entity_id, diff jsonb, created_at
notifications      id, user_id, kind, payload jsonb, read_at
push_subscriptions id, user_id, endpoint, keys jsonb
refresh_tokens     id, user_id, token_hash, family_id, expires_at, revoked_at
outbox             id, topic, payload jsonb, created_at, published_at
budgets            id, workspace_id, category_id?, period, amount_minor, currency
```

**Indexes:** `expenses(workspace_id, date DESC, id)` for cursor pagination;
`expense_splits(workspace_id, user_id)`; `settlements(workspace_id)`; and a `pg_trgm` GIN index on
`expenses.description` for search. All changes go through **drizzle-kit migrations** (generate →
review → `migrate`), with no more `push` in production.

**Balances:** `member_balances` is updated by the same transaction that writes an expense or
settlement (apply the delta on create, reverse and re-apply it on edit, reverse it on delete). Reading
balances is then one indexed lookup. "Who owes whom" is **derived from net balances** with the
existing simplification algorithm, which fixes issue #1. A nightly job recomputes balances from source
rows and alerts on any drift.

---

## 4. Phases

### Phase 0 — Foundation and correctness (do first)

1. Commit or stash the current uncommitted Drizzle work so the plan starts from a clean baseline.
2. Add a `Money` value object and allocation with the **largest-remainder** rule so splits always sum
   exactly to the total. Unit-test it heavily (property tests with `fast-check`).
3. Replace the `if/else` with a strategy registry, and add **SHARES** and **ADJUSTMENT** strategies.
4. Wrap every write use case in a Unit of Work. Edits recompute splits and balance deltas, with
   optimistic locking through `version`.
5. Add the `member_balances` table, rewrite balances and debts on top of it, and fix the
   friends-balance query so it only touches users who share a workspace with the caller.
6. Server-side search, filters and cursor pagination for expenses and activity.
7. Switch to migrations, and add `migrate` to the deploy pipeline.
8. CI: run unit tests, plus integration tests against a real Postgres (Testcontainers or a service
   container), plus the OpenAPI client codegen drift check.

### Phase 1 — Security hardening

- **Auth:** the OAuth callback sets a short-lived (15 min) access token and a rotating refresh token
  as `httpOnly; Secure; SameSite=Lax` cookies. No token in the URL or `localStorage`. Refresh-token
  reuse revokes the whole token family. Add a `/auth/logout` endpoint that revokes it.
- Validate the OAuth `state` parameter, and check `Origin`/`Referer` on state-changing requests (CSRF).
- `@fastify/helmet` (strict CSP), `@nestjs/throttler` backed by Redis (per-IP and per-user), body
  size limits, and Zod validation on every DTO (already partly done).
- **Tenant isolation:** `WorkspaceMemberGuard` plus workspace-scoped repository methods, with an
  authorization test suite that tries to access other workspaces through every endpoint. Then either
  wire RLS properly (`set_config` inside each transaction) or delete `rls.sql`. **Recommendation:**
  delete it; app-layer enforcement plus tests is simpler and works with Neon's pooler.
- Never return other users' emails except to members who share a workspace. Add audit log entries for
  member and role changes.
- Account deletion and export (GDPR): anonymize the user while keeping ledger integrity.
- Dependency scanning (`npm audit` and Dependabot) and secret scanning in CI.

### Phase 2 — Splitwise parity

- **Groups and friends:** groups (`GROUP`), plus 1:1 friend ledgers (`DIRECT`, created automatically
  the first time you add an expense with someone outside a group). The Friends page shows the net per
  friend across all shared ledgers, per currency.
- **Invites:** shareable invite link or QR code, plus email invites. Placeholder (unregistered)
  members get merged into the real account on first Google sign-in with the same email.
- **Expenses:** multiple payers, all split types, notes, category, tags, date, and receipt attachment.
  Edits record a diff in `activity_log`; deletes are soft, with a 10-second **Undo** toast.
- **Settle up:** suggested payments from simplified debts, partial settlements, and per-group
  simplification on/off.
- **Activity feed** per group and globally, plus **comments** on expenses.
- Roles: ADMIN can manage members and settings; any member can add expenses; editing is allowed for
  the creator and admins. All of this goes through `WorkspacePolicy`.
- Leave or archive a group (blocked while you have a non-zero balance unless an admin overrides).

### Phase 3 — Fast UX, PWA and real-time

- **Optimistic mutations** everywhere (TanStack Query `onMutate` with rollback), and **idempotency
  keys** (`Idempotency-Key` header, stored for 24 h) so retries and offline replays never duplicate
  an expense.
- **PWA:** `vite-plugin-pwa`, an app-shell cache, query cache persisted to IndexedDB, and an offline
  mutation queue replayed in order when the app comes back online. Installable, with a maskable icon.
- **Real-time:** the outbox worker publishes to Redis channel `ws:{workspaceId}`. A
  `GET /workspaces/:id/events` **SSE** endpoint (with a heartbeat and resume through `Last-Event-ID`)
  pushes `{type, entityId, version}`, and the client invalidates or patches the matching query keys.
  SSE is chosen over WebSockets because it is simpler, uses plain HTTP, and the data flows one way.
- **Perceived speed:** route-level code splitting, preloading on hover (TanStack Router `preload`),
  skeletons instead of spinners, virtualized lists (`@tanstack/react-virtual` is already installed),
  and `staleTime` tuned per query.
- **Quick add:** a global `N` shortcut plus a command palette (`⌘K`). A natural-language parser (local
  and deterministic) turns "dinner 1200 with Ana, Raj" into amount, participants and description.
  Smart defaults: last group, last split, and the current user as payer.
- **Cold starts:** keep the health-check toast; also move the API to an always-on instance, or add a
  scheduled warm-up ping.

### Phase 4 — Multi-currency and payments

- Each expense carries its own currency, and balances are stored and shown **per currency** (no
  silent conversion).
- `FxRateProvider` adapter (ECB rates via Frankfurter, which is free) fetched daily into `fx_rates`.
  The UI offers an optional "total in my currency" view using the rate for the expense date or the
  latest rate.
- "Settle in another currency": record a settlement in currency B against a debt in currency A at an
  explicit rate (stored on the settlement).
- **Payment deep links:** `PaymentLinkBuilder` strategies for UPI
  (`upi://pay?pa=&pn=&am=&cu=INR&tn=`), PayPal.me and Venmo, built from the payee's saved handles.
  After returning from the payment app, prompt "Did you pay ₹X?" to record the settlement. Money never
  passes through ExpenseSplit, so there is no PCI scope.

### Phase 5 — Recurring bills, reminders and notifications

- `recurring_rules` with RRULE strings (`rrule` lib). A BullMQ repeatable scheduler creates the
  expenses (idempotent per `rule_id + occurrence_date`), and users can skip or edit a single
  occurrence.
- **Notifications:** in-app (`notifications` table plus SSE), **Web Push** (VAPID), and email through a
  `Mailer` adapter (Resend or SES), with per-user, per-event preferences.
- **Reminders:** a "Nudge" button on a debt (rate-limited to once a day), plus an optional weekly
  digest of what you owe and are owed.

### Phase 6 — Receipt OCR and itemized split

- Upload straight to object storage (Cloudflare R2 or S3) with a **presigned URL**. The API only
  records metadata. Images are resized and EXIF-stripped on the client first.
- The OCR worker (existing BullMQ queue) calls the `OcrProvider` adapter and returns merchant, date,
  total, tax and tip, plus line items. The result streams back to the client over SSE.
- **Itemized split UI:** tap items to assign them to people (shared items split by shares); tax and
  tip are spread proportionally; the user confirms before saving. Uses the `ITEMIZED` strategy.
- Auto-suggest a category from the merchant (rules first, an LLM fallback later if wanted).

### Phase 7 — Analytics, tags and UI polish

- Indexed tags (`expense_tags`) with autocomplete, plus default and custom categories with
  icons and colors.
- **Analytics:** spend over time (week/month), by category, by tag, by member, "my share" vs "group
  total", month-over-month change, and top merchants. Queries run on SQL aggregates and are cached in
  Redis per workspace (invalidated by outbox events).
- **Budgets** per group or category, with alerts at 80% and 100%.
- Export to CSV or PDF per group and date range; import from Splitwise CSV (big for switchers).
- UI: dark mode (already present), responsive mobile-first layouts, an accessibility pass (WCAG AA,
  keyboard navigation), empty states, and i18n-ready strings with locale currency formatting.

### Phase 8 — Observability and scale checks

- Dashboards for p95 latency per route, queue lag, SSE connections and the outbox backlog.
- k6 load test: 1,000 concurrent users, a 10k-expense group, and balance reads under 50 ms.
- Error tracking (Sentry) on frontend and backend, plus Playwright end-to-end tests for the core flows
  (sign in → create group → add expense → settle up).

---

## 5. API additions (high level)

```text
POST   /auth/refresh                         POST /auth/logout
GET    /workspaces/:id/expenses?cursor&q&tag&category&from&to
POST   /workspaces/:id/expenses              (Idempotency-Key)
PATCH  /expenses/:id                         (If-Match: version)
POST   /expenses/:id/restore                 GET|POST /expenses/:id/comments
POST   /workspaces/:id/invites               POST /invites/:token/accept
GET    /workspaces/:id/events                (SSE)
GET    /friends   GET /friends/:userId/ledger
POST   /receipts/upload-url                  GET /receipts/:id
GET|POST|PATCH /workspaces/:id/recurring
GET    /notifications   PATCH /notifications/:id/read   POST /push/subscribe
GET    /fx/rates?date&base
GET    /workspaces/:id/settle-up/suggestions GET /settlements/:id/payment-link
GET    /workspaces/:id/analytics?from&to&groupBy   GET /workspaces/:id/export.csv
```

OpenAPI stays the contract: edit `openapi.yaml` → regenerate the client → CI fails on drift.

---

## 6. Decisions still open (defaults chosen; change if needed)

| Decision | Default |
|----------|---------|
| OCR provider | Google Cloud Vision or Claude vision, behind `OcrProvider` |
| Email | Resend |
| Object storage | Cloudflare R2 |
| Redis host | Upstash (serverless, works with BullMQ and pub/sub) |
| RLS | Remove; enforce in the app layer and back it with tests |
| Backend hosting | Render paid instance (no cold starts), or Fly.io |
