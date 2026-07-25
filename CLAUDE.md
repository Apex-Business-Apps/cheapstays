# CLAUDE.md — CheapStays Agent Baseline

**Canonical baseline as of:** 2026-05-24  
**Branch:** main @ `a393243` + hotfixes (PR post-#43)  
**Project:** CheapStays — Philippine short-term rental marketplace  
**Org:** JGP Corporation, Pasig City, Metro Manila, Philippines

This file is the single source of truth for any AI agent working on this repo. Read it before touching anything. It documents working architecture, contracts, RLS constraints, and regression trip-wires established after fixing production bugs in PRs #41–43.

---

## 1. Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + TypeScript 5, Tailwind CSS, shadcn/ui, Framer Motion |
| Routing | react-router-dom v6 |
| State / Data | @tanstack/react-query v5 + Supabase realtime subscriptions |
| Backend API | Supabase Edge Functions (Deno runtime) |
| Auth | Supabase Auth (JWT, email/password + magic link) |
| Database | PostgreSQL 17 via Supabase, RLS enforced on all tables |
| Storage | Supabase Storage (images, videos, KYC docs) |
| CDN / Hosting | Cloudflare Pages (work branch → preview, main → production) |
| Payments | PayMongo (primary), Stripe (secondary, requires ENABLE_UNAPPROVED_PROVIDERS=true) |
| Email | Resend (graceful no-op if RESEND_API_KEY missing) |
| Push notifications | Web Push API + VAPID keys |
| AI | Groq (llama-3.3-70b-versatile) via shared `groqChat()` helper |
| i18n | react-i18next |
| Testing | Vitest (unit), Playwright (E2E) |
| CI/CD | GitHub Actions → Cloudflare Pages |

---

## 2. Repository Layout

```
/
├── src/
│   ├── pages/          # Route-level components (Admin, Host, Search, etc.)
│   ├── components/     # Shared UI components + ui/ (Radix/shadcn)
│   ├── hooks/          # React hooks (see §6)
│   ├── integrations/supabase/
│   │   ├── client.ts   # Supabase browser client (anon key)
│   │   └── types.ts    # Auto-generated DB types (do not edit manually)
│   └── test/           # Vitest tests
├── supabase/
│   ├── functions/      # Edge functions (Deno) — one directory per function
│   │   └── _shared/    # Shared utilities imported by edge functions
│   └── migrations/     # Ordered SQL migrations — apply in filename order
├── e2e/                # Playwright E2E tests
├── docs/               # Extended documentation
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── RUNBOOK.md
│   └── SECURITY.md
└── CLAUDE.md           # ← this file
```

---

## 3. RBAC Roles

Roles are stored in `user_roles(user_id, role, granted_by)`. Checked via `has_role(_user_id, _role)` RPC (returns boolean).

| Role | Description |
|------|-------------|
| `admin` | Full access — can approve hosts, manage tickets, mutate roles |
| `host` | Can create/manage listings and accept bookings |
| `member` | Paid membership (₱249/month via PayMongo) |
| `user` | Default authenticated user |

**Self-grant is blocked** on `grant-host-role` (deprecated). The approved host-grant paths are:
1. `approve-host-application` — for KYC form submissions (`host_applications` table)
2. `approve-host-via-ticket` — for chat-based applications (`support_tickets` with `category=host_verification`)

Never call `grant-host-role` directly for new work. See §4.

---

## 4. Edge Function Registry

All edge functions live under `supabase/functions/<name>/index.ts`. All functions:
- Accept `OPTIONS` and return CORS headers (see `_shared/cors.ts`)
- Validate body with Zod before processing
- Require Bearer token auth unless noted otherwise
- Rate-limit via `await rateLimit(key, max, windowMs)` — **`await` is required**, omitting it silently bypasses rate limiting

### 4.1 Host Approval Functions

#### `approve-host-via-ticket` ✅ CURRENT (PR #43)
- **Purpose:** Approve a host application submitted via Support chat
- **Auth required:** Yes — caller must be `admin`
- **Body:** `{ ticket_id: UUID }`
- **Flow:**
  1. Fetches ticket by `ticket_id` — extracts `user_id` server-side (no client-supplied `target_user_id`)
  2. Verifies `ticket.category === "host_verification"` — rejects with 400 otherwise
  3. Idempotent: if user already has host role, resolves ticket and returns `{ success: true, already_host: true }`
  4. Grants host role via service role client (no self-grant restriction — this is intentional)
  5. Confirms grant persisted via `has_role` RPC before writing audit
  6. Resolves ticket status to `"resolved"` only after confirmed grant
  7. Dispatches `host_status_approved` notification to the applicant
- **Success response:** `{ success: true, target_user_id, ticket_id }`
- **Error responses:** 400 wrong category | 401 unauth | 403 not admin | 404 ticket not found | 429 rate limit | 500 internal

#### `approve-host-application` ✅ CURRENT
- **Purpose:** Approve a host KYC form submission (`host_applications` table)
- **Auth required:** Yes — caller must be `admin`
- **Body:** `{ application_id: UUID, target_user_id: UUID, reason_code: string, reviewer_notes?: string }`
- **Requires:** `id_front_path` and `selfie_path` must be present on the application
- **Approvable statuses:** `pending` or `manual_review` only
- **Flow:** Same grant→confirm→audit→notify pattern as above
- **Rate limit:** 30 req/60s

#### `grant-host-role` ⛔ DEPRECATED — DO NOT CALL
- Retained for backwards-compatibility only
- **Blocks self-grant** (`user.id === target_user_id` → 400)
- Use `approve-host-via-ticket` or `approve-host-application` instead
- Will be removed in a future cleanup

### 4.2 Admin Role Mutation

#### `admin-role-mutation`
- **Auth required:** Yes — caller must be `admin`
- **Body:** `{ target_user_id, operation: "grant"|"revoke", role, reason_code, reviewer_notes? }`
- Writes to `role_mutation_audit` (immutable — no UPDATE/DELETE policies on that table)
- **Do not call for host approvals** — use the host-specific functions above

### 4.3 Booking Functions

#### `book-listing`
- **Auth required:** Yes
- **Body:** `{ listing_id, check_in, check_out, guests, guest_message? }`
- Validates: date ordering, min_nights, max_guests, availability conflicts
- Auto-confirms if `listing.instant_book = true`
- Returns `{ booking_id }`

#### `booking-checkout`
- **Auth required:** Yes
- **Body:** `{ booking_id }`
- Creates PayMongo hosted checkout session
- Returns `{ checkout_url }` for redirect
- Rate limit: 5 req/60s

#### `payment-intent`
- **Auth required:** Yes
- Dual provider: PayMongo (default) or Stripe (requires `ENABLE_UNAPPROVED_PROVIDERS=true`)
- Builds refund window: refundable until 2 days before check-in
- Payout releases 1 day after check-in

### 4.4 Support Functions

#### `support-ticket`
- **Auth required:** Yes
- Creates new ticket; auto-escalates on `urgent` priority or extreme keywords (fraud, assault, lawsuit)
- AI responds immediately if not escalated

#### `support-message`
- **Auth required:** Yes
- Posts message to existing ticket
- Triggers AI response if ticket not escalated
- **RLS constraint:** INSERT requires `author_user_id = auth.uid()` — always include this field

### 4.5 AI Functions

#### `ai-chat`
- Streaming Groq chat (llama-3.3-70b-versatile)
- Guardrail checks via `_shared/ai-governance.ts`
- Detects listing/rating/booking keywords to inject live context
- Rate limit: 40 req/60s

#### `ai-search`
- **Body:** `{ query, maxNightly?, minNights?, city? }`
- Returns up to 6 ranked listings

#### `ai-describe`
- **Body:** `{ title, bullets: string[], tone?: "confident"|"playful"|"minimal" }`
- Returns AI-generated listing description

### 4.6 Payment Webhooks

#### `membership-webhook` / `payment-webhook` / `stripe-webhook`
- No auth required (signature-verified)
- **All webhook events recorded in `webhook_events(provider, event_id, ...)` for idempotency**
- State machine guards prevent invalid status transitions
- Stripe disabled by default — requires `ENABLE_UNAPPROVED_PROVIDERS=true`

### 4.7 Notification Functions

#### `send-push-notification`
- Internal — expects service_role caller
- Cleans up 404/410 expired push subscriptions automatically

#### `send-email-notification`
- Internal — expects service_role caller
- Graceful no-op if `RESEND_API_KEY` not set

### 4.8 Other Functions

| Function | Notes |
|----------|-------|
| `agoda-search` | Proxy to Agoda affiliate API, top 9 PH properties, no auth |
| `assign-member-role` | Self-service — only allows `member` role, no admin required |
| `membership-payment-intent` | PayMongo checkout for ₱249/month membership |
| `omnihub-role-authority` | OmniHub/GitHub registry commands via `execute_role_mutation` RPC |

### 4.9 Manual Disbursement Functions (host-controlled)

#### `request-disbursement`
- **Purpose:** Host requests a payout of their available wallet balance.
- **Auth required:** Yes — caller must own the wallet.
- **Body:** `{ }` (empty). User + wallet are derived server-side.
- **Preconditions:** `available_balance >= 500`, `host_payout_accounts.is_verified = true`, no in-flight request, once per 7 days.
- **Side effects:** Inserts a `disbursement_requests` row (`status = 'pending'`, `trigger = 'manual'`), debits `host_wallets.available_balance` to 0, inserts a `debit_disbursement` ledger row, notifies every admin.
- **Rate limit:** 1 req / 7 days per host.

#### `admin-attach-disbursement-proof`
- **Purpose:** Admin uploads a screenshot / QR of the manual payment they sent off-platform.
- **Auth required:** Yes — caller must be `admin`.
- **Body:** `{ disbursement_id, proof_image_path, admin_note? }`. The client uploads the image to Storage bucket `disbursement-proofs` first, then passes the resulting path here.
- **Allowed statuses:** `pending` only.
- **Side effects:** Sets `status = 'awaiting_confirmation'`, records `released_by`, `released_at`, `proof_image_path`, `admin_note`; notifies the host.

#### `admin-reject-disbursement`
- **Purpose:** Admin rejects a payout request and refunds the wallet.
- **Auth required:** Yes — caller must be `admin`.
- **Body:** `{ disbursement_id, rejection_reason }`.
- **Allowed statuses:** `pending` or `awaiting_confirmation`.
- **Side effects:** Sets `status = 'rejected'`, records `rejected_by`/`rejected_at`/`rejection_reason`, adds `amount` back to `host_wallets.available_balance`, inserts a `debit_failed_reversal` ledger row, notifies the host.

#### `host-confirm-disbursement`
- **Purpose:** Host confirms they actually received the money in their off-platform account.
- **Auth required:** Yes — caller must own the wallet on the request.
- **Body:** `{ disbursement_id }`.
- **Allowed statuses:** `awaiting_confirmation` only.
- **Side effects:** Sets `status = 'released'`, records `confirmed_at`; notifies the host.

#### `process-monthly-payouts` ⏸ PAUSED
- Neutralized on 2026-07-22 in favor of the manual flow above. Returns `{ disabled: true }` immediately. The pg_cron schedule `cheapstays-monthly-host-payouts` was unscheduled in migration `20260722000000_host_controlled_disbursements.sql`. Do not re-enable without a product decision.

### 4.10 Stay Voucher Functions (prepaid overnight stays)

Coexists with the pre-existing hourly-voucher system (§4.9 is Manual Disbursement, then §4.10 is the new stay vouchers). Do not confuse `stay_voucher_*` with the pre-existing hourly `vouchers` table, `purchase-voucher`, and `redeem-voucher` functions — those are a separate, still-live product.

#### `admin-stay-voucher-batch-create`
- **Auth:** admin only (`has_role`).
- **Body:** `{ listing_id, batch_name, nights, price_php, quantity, valid_days, terms? }`. Caps: nights ≤30, quantity ≤500, valid_days 1–14.
- **Effect:** inserts a `stay_voucher_batches` row.

#### `admin-stay-voucher-batch-deactivate`
- **Auth:** admin only.
- **Body:** `{ batch_id }`. Sets `is_active=false`. Existing purchased codes remain valid until their own `valid_until`.

#### `stay-voucher-checkout` (anonymous public)
- **Auth:** none.
- **Body:** `{ batch_id, quantity, buyer_name, buyer_email, buyer_phone, payment_method, accept_terms: true }`.
- **Flow:** stock check → insert `stay_voucher_purchases` with minted `success_token` → PayMongo checkout session (metadata `{ purchase_id, kind: "stay_voucher" }`) → returns `{ checkout_url, purchase_id, success_token }`.
- **Rate limit:** 10 req/60s per IP.

#### `stay-voucher-webhook`
- **Auth:** PayMongo signature.
- **Effect:** idempotent via `webhook_events(provider='paymongo_stay_voucher', event_id)`; marks purchase `paid`, mints `quantity` codes with `valid_until = paid_at + batch.valid_days days`, emails buyer via Resend.

#### `stay-voucher-purchase-lookup` (anonymous public)
- **Auth:** none — verifies `success_token`.
- **Body:** `{ purchase_id, success_token }` → `{ payment_status, codes | null, batch: { name, nights, price_php, valid_until, listing } }`.

#### `stay-voucher-resend-email` (anonymous public)
- **Auth:** none — verifies `success_token`.
- **Body:** `{ purchase_id, success_token }`. Rate limit: 5 req/60s per purchase.

#### `host-stay-voucher-preview`
- **Auth:** host only.
- **Body:** `{ code }` → batch + buyer name + `valid_until` if host owns the listing; else 403.

#### `host-stay-voucher-redeem`
- **Auth:** host only.
- **Body:** `{ code, listing_id, p_check_in }`.
- **Effect:** calls the `redeem_stay_voucher_transaction(p_code, p_listing_id, p_caller_id, p_check_in)` RPC which locks the code row, verifies listing/host ownership + status + expiry, inserts a `stay_type='voucher'` booking (`payment_status='paid'`, `status='confirmed'`, `flow_state='active'`, `guest_id=NULL`, `guest_name_snapshot=buyer_name`), and updates the voucher to `claimed`. Wallet crediting follows the standard paid-booking pipeline (`credit-host-wallet` 10 % fee, `release-pending-balance` 1 day after check-out). The wallet credit is fire-and-log — if the credit-host-wallet call fails the booking still succeeds and admins reconcile out of band.
---

## 5. Database — Critical Constraints

### RLS Constraints That Have Caused Bugs

**`support_messages` INSERT:**
```sql
-- Policy: "Users and admins can insert messages"
-- Requires author_user_id = auth.uid() for BOTH user and admin inserts
```
Always include `author_user_id: user.id` when inserting into `support_messages`. Missing this field causes a silent RLS rejection (appears as "could not send reply" error on the frontend).

**`notifications` SELECT:**
```sql
-- Policy: users can only see their own notifications
-- Filter: user_id = auth.uid()
```
Always add `.eq("user_id", userId)` when querying notifications. RLS handles it but the explicit filter is required to prevent the query returning nothing for admins.

**`role_mutation_audit` INSERT:**
```sql
-- Immutable: NO UPDATE or DELETE policies exist
-- Required columns: command_id, command_source, requester_id, approver_id,
--                   operation (enum), target_user_id, reason_code,
--                   before_state (JSONB), after_state (JSONB)
```
Write once. The `operation` column is an enum — current values: `grant_host`, `revoke_host`.

### Key Tables

| Table | Purpose | Notable Columns |
|-------|---------|-----------------|
| `user_roles` | RBAC | user_id, role (app_role enum), granted_by |
| `host_applications` | KYC form submissions | status (pending/manual_review/approved/rejected), id_front_path, selfie_path, reviewed_by |
| `support_tickets` | Support queue + host verification | category (incl. `host_verification`), user_id, status, priority |
| `support_messages` | Ticket threads | ticket_id, author_user_id (**required**), sender, content |
| `notifications` | In-app notification queue | user_id, type, title, body, read |
| `role_mutation_audit` | Immutable audit trail | command_id, operation, before_state, after_state |
| `webhook_events` | Idempotency for payment webhooks | provider, event_id, event_type, booking_id |
| `push_subscriptions` | Web push endpoints | endpoint, p256dh, auth_key |
| `disbursement_requests` (extended) | Payout requests | `status` now includes `awaiting_confirmation`, `released`, `rejected`. Partial unique index blocks two in-flight requests per wallet. `trigger` column: `'manual'` (host-initiated) or `'auto'` (paused monthly cron). |
| `stay_voucher_batches` | Admin-created prepaid stay voucher batches | listing_id, nights, price_php, quantity, valid_days (1–14), is_active |
| `stay_voucher_codes`   | Individual redeemable codes (`CS-XXXX-XXXX`) | batch_id, code UNIQUE, status ('unclaimed'/'claimed'/'expired'), purchase_id, valid_until |
| `stay_voucher_purchases` | Anonymous PayMongo purchases | batch_id, buyer_name/email/phone, success_token (nonce), payment_status |
| `platform_revenue_events` | Generic platform revenue log | source ('voucher_expired' at ship time), amount_php, stay_voucher_code_id |

**Storage bucket `disbursement-proofs`** (private, 10 MB, image-only): admin uploads proof of off-platform payment. Path convention: `{wallet_id}/{disbursement_id}.{ext}`. Admins write and read; hosts can read only their own wallet's folder.

**`bookings.guest_name_snapshot`** — nullable column populated only when the booking was created via voucher redemption. Anonymous voucher purchases have no `auth.users` row, so the buyer name is carried onto the booking via this snapshot.

### Host Application Paths — BOTH Must Be Handled

There are **two separate paths** for host applications. Both must surface in the Admin UI:

**Path A — KYC form** (`/host/apply`)
- Writes to: `host_applications` table
- Admin action: `approve-host-application` edge function
- Admin UI: Applications tab → "Host Applications" section

**Path B — Support chat** (user sends a support message requesting host access)
- Writes to: `support_tickets` table with `category = "host_verification"`
- Admin action: `approve-host-via-ticket` edge function (takes only `ticket_id`)
- Admin UI: Applications tab → "Verification requests" section (surfaced from tickets state)

**Never** assume all host applications are in `host_applications`. The Applications tab must query both.

---

## 6. React Hooks — Key Details

### `useNotifications` (`src/hooks/useNotifications.ts`)

```typescript
const userId = user?.id;  // extract string — NOT the user object

const loadData = useCallback(async () => {
  // ...
}, [userId]);  // string dep prevents infinite re-render loop

// Always filter explicitly:
.eq("user_id", userId)

// Realtime subscription:
useEffect(() => { ... }, [userId]);  // NOT [user]

// markAllRead depends on:
}, [userId, items]);  // NOT [user, items]
```

**Common mistake:** Using `[user]` (object) as dependency causes infinite re-renders because `user` object reference changes on every auth state check.

### `useAuth` (`src/hooks/useAuth.tsx`)
- `user` comes from `useState<User | null>`
- Auth state fires twice on mount (getSession + onAuthStateChange) — hooks must be stable
- `hasRole(role)` — checks roles array on user metadata

---

## 7. Admin Page (`src/pages/Admin.tsx`)

### Host Approval in the Admin UI

```typescript
// Correct signature — ticketId only, user_id fetched server-side
const grantHostRole = async (ticketId: string) => { ... };

// Calls:
supabase.functions.invoke("approve-host-via-ticket", {
  body: { ticket_id: ticketId },
});

// Error parsing — must unwrap FunctionsHttpError:
const body = await (error as { context?: Response }).context?.json();
if (body?.error) msg = body.error;
```

**Do not** call `grant-host-role` from the Admin page. It is deprecated and blocks self-grant.

### Ticket Type

```typescript
type SupportTicket = {
  id: string;
  ticket_num: number;
  subject: string;
  status: string;
  priority: string;
  category: string;
  escalated: boolean;
  created_at: string;
  user_id: string;  // required — used by grantHostRole to identify applicant
};
```

`user_id` must be in the SELECT query:
```typescript
.select("id,ticket_num,subject,status,priority,category,escalated,created_at,user_id")
```

### pendingVerificationTickets
Derived from tickets state (not a separate query):
```typescript
const pendingVerificationTickets = useMemo(
  () => tickets.filter((t) => t.category === "host_verification" && t.status !== "resolved"),
  [tickets]
);
```

---

## 8. Shared Edge Function Utilities

All live in `supabase/functions/_shared/`.

| File | Key Export | Notes |
|------|-----------|-------|
| `cors.ts` | `corsHeaders` | Always return on OPTIONS |
| `auth.ts` | `getUserFromRequest(req)` | Returns `{user, supabase, error}` |
| `rate-limit.ts` | `rateLimit(id, max, windowMs)` | **Must `await`** — returns `{ok, remaining, retryAfterMs}` |
| `groq.ts` | `groqChat(opts)` | Groq API wrapper, llama-3.3-70b-versatile |
| `ai-governance.ts` | `detectGuardrailViolation()` | Bans: role grants, refund overrides, legal advice |
| `notify.ts` | `dispatchNotification(client, params)` | Respects notification_preferences; sends in-app + push + email |
| `payments.ts` | `buildRefundWindow()`, `validatePaymentMethod()` | Refund: -2d from check-in. Payout: +1d from check-in |
| `omniport.ts` | `omniportEmit()` | Best-effort audit emission — non-blocking |

---

## 9. Environment Variables

### Required for core function

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GROQ_API_KEY
PAYMONGO_SECRET_KEY
PAYMONGO_WEBHOOK_SECRET
SITE_URL                    # e.g., https://cheapstays.me — for payment redirects
```

### Required for features

```
RESEND_API_KEY              # Email notifications (graceful no-op if missing)
VAPID_PUBLIC_KEY            # Web push (base64url)
VAPID_PRIVATE_KEY           # Web push (base64url)
VAPID_EMAIL                 # VAPID contact
AGODA_SITE_ID               # Agoda affiliate search
AGODA_API_KEY               # Agoda affiliate search
STRIPE_SECRET_KEY           # Stripe payments (also needs ENABLE_UNAPPROVED_PROVIDERS=true)
STRIPE_WEBHOOK_SECRET       # Stripe webhooks
OMNIPORT_BASE_URL           # OmniHub audit stream
OMNIPORT_TOKEN              # OmniHub API token
```

### Feature flags

```
ENABLE_UNAPPROVED_PROVIDERS  # Set to "true" to allow Stripe and non-PayMongo providers
```

---

## 10. CI/CD Pipeline

### PR checks (`.github/workflows/pr-checks.yml`)
Runs on every PR to `main`:
1. ESLint
2. TypeScript typecheck (`tsc --noEmit`)
3. Vitest unit tests
4. Vite production build
5. npm audit (non-blocking)
6. Playwright E2E (against preview build)
7. Cloudflare Pages preview deploy → posts preview URL comment

### Production release (`.github/workflows/release-production.yml`)
Runs on push to `main`:
1. `npm run build`
2. `npm run deploy:production` → Cloudflare Pages main branch

---

## 11. Regression Trip-Wires

These are the specific bugs that were fixed in PRs #41–43. Do not reintroduce them.

### ❌ Missing `author_user_id` in support_messages INSERT
```typescript
// WRONG — fails silently at RLS
{ ticket_id, sender: "admin", content }

// CORRECT
{ ticket_id, sender: "admin", content, author_user_id: user.id }
```

### ❌ Missing `await` on `rateLimit()`
```typescript
// WRONG — rl is a Promise, !rl.ok is always false (rate limiting never fires)
const rl = rateLimit(`key`, 20, 60_000);

// CORRECT
const rl = await rateLimit(`key`, 20, 60_000);
```

### ❌ Calling deprecated `grant-host-role` for host approvals
```typescript
// WRONG — deprecated, blocks self-grant, returns generic 400
supabase.functions.invoke("grant-host-role", { body: { target_user_id, operation: "grant", ... } });

// CORRECT (ticket-based)
supabase.functions.invoke("approve-host-via-ticket", { body: { ticket_id } });

// CORRECT (application-based)
supabase.functions.invoke("approve-host-application", { body: { application_id, target_user_id, reason_code } });
```

### ❌ Using object `[user]` as useCallback/useEffect dependency
```typescript
// WRONG — object reference changes on every auth state check → infinite loop
const loadData = useCallback(async () => { ... }, [user]);

// CORRECT — extract primitive first
const userId = user?.id;
const loadData = useCallback(async () => { ... }, [userId]);
```

### ❌ Not parsing FunctionsHttpError response body
```typescript
// WRONG — shows "Edge Function returned a non-2xx status code" always
toast.error(error.message);

// CORRECT — unwrap the actual error
let msg = error.message;
try {
  const body = await (error as { context?: Response }).context?.json();
  if (body?.error) msg = body.error;
} catch { /* ignore */ }
toast.error(msg);
```

### ❌ Applications tab only querying `host_applications`
Applications submitted via Support chat go to `support_tickets` (category `host_verification`), not `host_applications`. Both sources must be surfaced in the Applications tab.

---

## 12. AI Governance

AI prompts are version-tagged in the format `YYYY-MM-DD.surface.vN` (e.g., `2026-05-22.support.v1`) for audit trail.

Guardrail patterns that are banned (defined in `_shared/ai-governance.ts`):
- Granting or modifying roles
- Overriding policies or security controls
- Processing refunds or payouts
- Providing legal or medical advice
- Handling emergencies or urgent safety situations

All AI decisions (allowed and blocked) are logged to `ai_audit_logs(decision_type, reason, payload)`.

---

## 13. Payment Architecture

- **Primary provider:** PayMongo (GCash, Maya, card)
- **Secondary provider:** Stripe — disabled by default, requires `ENABLE_UNAPPROVED_PROVIDERS=true`
- **Blocked payment methods:** prepaid, gift, anonymous_reloadable
- **Refund window:** Customer can request refund up to 2 days before check-in
- **Payout hold:** Host payout releases 1 day after check-in
- **Webhook idempotency:** All webhook events are recorded in `webhook_events(provider, event_id)` before processing — duplicate events are ignored

---

## 14. Notification System

Notifications flow through three channels, controlled by `notification_preferences(user_id, category, in_app_enabled, push_enabled, email_enabled)`:

1. **In-app** — Always sent if `in_app_enabled`. Stored in `notifications` table. Frontend polls and subscribes via Supabase realtime.
2. **Push** — Sent only for high-value events (e.g., `host_status_approved`, `booking_confirmed`). Requires VAPID keys and active `push_subscriptions` record.
3. **Email** — Sent via Resend if `RESEND_API_KEY` is set and user has `email_enabled`.

The `dispatchNotification()` helper in `_shared/notify.ts` handles all three channels and preference checking.

---

## 15. Test Coverage

### Unit tests (Vitest) — `src/test/`
- `auth-page.test.tsx` — Auth page rendering
- `navbar-cta.test.tsx` — Navbar CTA
- `notification-preferences.test.tsx` — Notification settings UI
- `legal-pages.test.tsx` — Legal document pages

### E2E tests (Playwright) — `e2e/`
- `auth.spec.ts` — Sign in / sign up flow
- `search.spec.ts` — Search and filter
- `listing-detail.spec.ts` — Listing page interactions
- `navigation.spec.ts` — Routing
- `responsive.spec.ts` — Mobile viewport
- `sitemap.spec.ts` — Sitemap generation

Run: `npm run test` (unit) · `npm run e2e` (E2E) · `npm run typecheck` (types)

---

## 16. Working Development Branch

New work should be developed on a dedicated branch and merged via PR with CI green. The `work` branch deploys to the Cloudflare Pages preview environment automatically.

Never push directly to `main`. CI must pass before merge.

---

---

## 17. Additional Regression Trip-Wires (post-PR #43)

### ❌ Navbar — redundant "Host tools" button alongside "Host" nav link
The center nav already includes a "Host" link to `/host` for all users. A separate "Host tools" button on the right-side actions area was redundant and has been removed. The Sign Out button is retained. Do not re-add a "Host tools" / "Go to host" CTA button to the right-side actions.

### ❌ Notifications page crash — `<Tabs>` without `<TabsContent>` children
`Notifications.tsx` used `<Tabs>` as a pure UI value selector (no `<TabsContent>` children), rendering content manually via external state. Radix UI `@radix-ui/react-tabs` v1.1.x requires `<TabsContent>` children to match each `<TabsTrigger>` in controlled mode — omitting them causes a synchronous rendering error caught by the `ErrorBoundary` ("Something went wrong"). Mobile users were redirected away before seeing it; desktop users stayed on the error page.

**Fix:** Wrap each tab's content in a proper `<TabsContent value="...">` block. The Notifications page now uses `TabsContent` for all three tabs (`all`, `unread`, `settings`).

### ❌ `host_profiles.verification_status` not updated on host approval
Both `approve-host-application` and `approve-host-via-ticket` granted the host role via `user_roles` and updated `host_applications.status` to `"approved"`, but **never updated `host_profiles.verification_status` to `"verified"`**. The `HostDashboard` reads `verification_status` from `host_profiles` to display the "Identity verification" card. Without this update the card always showed "Pending review" even after approval.

**Fix:** Both edge functions now upsert `{ verification_status: "verified", verified_at: <ISO> }` into `host_profiles` (on conflict: `user_id`) immediately after the role grant is confirmed and before writing the audit record.

### ❌ No delete listing UI or backend path for hosts
`MyListings` component had no way to delete a listing. Hosts with incorrect or test listings had no self-service removal option.

**Fix:** Added a two-step "Delete listing" → "Confirm delete" flow in `MyListings`. The delete calls `supabase.from("listings").delete().eq("id", id).eq("host_id", userId)` — the double filter (`id` + `host_id`) ensures the RLS policy and an explicit ownership check both pass. Cancelled bookings referencing the deleted listing retain their row; the listing's `host_id` FK is set to cascade or set-null per the schema.

### ❌ Body-level mandatory scroll snapping on the landing page (massive layout shift)
The homepage once toggled a `snap-landing-active` class on `<body>` that applied
`scroll-snap-type: y mandatory` plus `min-height: 100svh` on each section panel.
Two failure modes resulted:
1. **Scroll-snap containers disable browser scroll anchoring.** The Popular Cities /
   Featured Stays / Quick Stays sections load data asynchronously (skeleton → cards),
   so every height change above the viewport shoved all content down/up with no
   compensation — a massive visible layout shift on every load and re-snap.
2. **`min-height: 100svh` panels** stretched short sections (a marketplace with few
   listings) into mostly blank full-viewport bands, making sections look missing.

A second, independent suppressor was found while verifying the fix: the
`AtmosphericSection` parallax layers (`.atmo-bg-layer` etc.) animate `transform`
every frame while their spring settles. When Chrome selects one as its
scroll-anchor node, scroll anchoring is suppressed and the shift returns even
without snap. They are opted out via `overflow-anchor: none` in `src/index.css`.

**Fix:** The landing page uses natural document flow. The snap CSS block was removed
from `src/index.css`, the body-class toggle was removed from `src/pages/Index.tsx`,
the inert `snap-landing-*` classes were stripped from components, and the atmo
layers carry `overflow-anchor: none`.

**Guardrails:** `scripts/guardrails/check-landing-layout-stability.mjs` (in `npm run
guardrails`, CI-enforced) bans document-axis mandatory snapping, the
`snap-landing-active` mechanism, removal of the homepage's five sections, and removal
of the loading skeletons. `e2e/homepage-layout-stability.spec.ts` asserts sections
render, the document is not a snap container, CLS < 0.1, and that late content growth
does not yank the viewport. `src/test/incident-regression.test.ts` mirrors the static
checks in Vitest. Do not re-add scroll snapping to the document scroller; if a
snap-like feel is ever wanted, it must live in an inner overflow container with
stable (non-async) panel heights.

*Last updated by: Claude Code — landing layout-shift fix (2026-07-07)*

### ❌ Adding a new disbursement request without checking the in-flight partial unique index
The `disbursement_requests` table has `uniq_disbursement_in_flight` — a partial unique index on `(wallet_id) WHERE status IN ('pending','awaiting_confirmation')`. Two active requests per wallet is impossible at the DB level. The edge function `request-disbursement` also checks explicitly for a clearer error message; do not remove either layer.

### ❌ Editing `process-monthly-payouts` as if it were live
It was paused on 2026-07-22 in favor of the manual host-controlled flow. The pg_cron schedule was dropped. The function returns `{ disabled: true }` on every call. Its old Xendit sweep logic is retained as a `/* PAUSED ... */` comment for reference only. Do not "re-enable" without a product decision — the host-controlled flow is the current design.

### ❌ Referencing `has_role` via JWT claim in new RLS policies
The 2025-05-27 wallet migration used `auth.jwt() ->> 'role' = 'admin'` for admin bypass. This is inconsistent with the rest of the app which uses `public.has_role(auth.uid(), 'admin')`. New RLS and storage policies (see the `disbursement-proofs` bucket in migration `20260722000000`) must use `has_role`.

### ❌ Confusing the hourly voucher system with the stay voucher system
The codebase runs two independent voucher products:
- **Hourly vouchers** (older): tables `vouchers`, RPC `redeem_voucher_transaction`, edge functions `purchase-voucher`/`redeem-voucher`, UI in `BookingPanel`/`HostVouchers`/`TodayActivityTab`, public route `/vouchers`, host route `/host/vouchers`.
- **Stay vouchers** (this feature): tables `stay_voucher_*`, RPC `redeem_stay_voucher_transaction`, edge functions `stay-voucher-*` / `admin-stay-voucher-*` / `host-stay-voucher-*`, UI in `src/components/stay-vouchers/*` and `src/pages/stay-vouchers/*`, public routes under `/stay-vouchers`, host route `/host/redeem-stay-voucher`, admin route `/admin/stay-vouchers`.
Do not rename one to the other. Do not merge tables. Anything referring to a batch (`batch_id`), an anonymous buyer, or a `stay_voucher_` identifier is the new system.

### ❌ Inserting `stay_voucher_purchases` from the client
Client SDK insert bypasses the server-generated `success_token` and PayMongo idempotency key. The success page's anonymous lookup relies on that token being minted server-side. Always call the `stay-voucher-checkout` edge function.

### ❌ Redeeming a voucher without going through the RPC
The redemption path must go through `redeem_stay_voucher_transaction`. The RPC locks the code row (`FOR UPDATE`) to block concurrent double-redemption, and inserts the `bookings` row + updates the code row + snapshots the buyer name in one transaction. Client-side or edge-function-side sequenced writes will race and can create ghost bookings or leave codes in inconsistent states.
