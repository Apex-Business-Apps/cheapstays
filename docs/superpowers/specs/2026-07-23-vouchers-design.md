# Voucher Generation — Design Spec

**Date:** 2026-07-23
**Branch:** `feat/vouchers`
**Status:** Approved for implementation planning

---

## 1. Summary

Prepaid stay-voucher system, Groupon-style. Admin creates *voucher batches* for a specific listing (price + fixed nights + quantity + valid-days). Anonymous public buys individual codes via a public `/vouchers` browse page. PayMongo hosted checkout collects payment. Codes are emailed via Resend and shown prominently on a success page. The guest presents the code at check-in; the host redeems it via `/host/redeem-voucher`, which creates a `stay_type='voucher'` booking and credits the host wallet via the existing payout schedule. Unredeemed vouchers expire in ≤14 days — the held money becomes platform revenue.

All money flow reuses existing infrastructure: PayMongo checkout, `webhook_events` idempotency, `credit-host-wallet` (10%/90% split), `release-pending-balance` (payout hold 1 day after check-out), `stay_type='voucher'` bookings scaffolding (already in migrations `20260620130000` + `20260716120000`).

---

## 2. Anchor Decisions

| # | Decision | Value |
|---|---|---|
| 1 | Voucher semantics | Prepaid stay package tied to a specific listing (Groupon-style) |
| 2 | Redemption model | Host-driven at check-in — guest never re-enters the platform after purchase |
| 3 | Package content | Price + fixed nights; max_guests inherits from listing |
| 4 | Expiration | Admin-set 1–14 days (default 14); forfeit on expiry → platform revenue |
| 5 | Refunds | All sales final; rules checkbox at checkout spells this out |
| 6 | Platform fee | 10% (same as bookings, reuses `credit-host-wallet`) |
| 7 | Admin visibility | Full purchases table: buyer name/email/phone, time, listing, status |

---

## 3. Data Model

### 3.1 New tables

**`voucher_batches`** — admin-created batches (the "product")
```
id                 UUID PK
listing_id         UUID FK listings(id) NOT NULL
batch_name         TEXT NOT NULL           -- admin-facing label ("Valentines promo")
nights             INT NOT NULL CHECK (nights BETWEEN 1 AND 30)
price_php          INT NOT NULL CHECK (price_php > 0)
quantity           INT NOT NULL CHECK (quantity BETWEEN 1 AND 500)
valid_days         INT NOT NULL CHECK (valid_days BETWEEN 1 AND 14)
terms              TEXT                     -- optional marketing/inclusions blurb
is_active          BOOLEAN NOT NULL DEFAULT true
created_by         UUID FK auth.users(id) NOT NULL
created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
```

**`vouchers`** — individual codes (one row per code)
```
id                     UUID PK
batch_id               UUID FK voucher_batches(id) ON DELETE RESTRICT NOT NULL
code                   TEXT NOT NULL UNIQUE           -- CS-XXXX-XXXX format
status                 TEXT NOT NULL DEFAULT 'unclaimed'
                       CHECK (status IN ('unclaimed','claimed','expired'))
purchase_id            UUID FK voucher_purchases(id) NOT NULL
booking_id             UUID FK bookings(id)            -- set on redemption
valid_until            TIMESTAMPTZ NOT NULL
redeemed_by_host_id    UUID FK auth.users(id)
redeemed_at            TIMESTAMPTZ
created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
```
Indexes: `UNIQUE(code)`, `INDEX(status, valid_until)` for the expiry cron.

**`voucher_purchases`** — one row per PayMongo checkout
```
id                 UUID PK
batch_id           UUID FK voucher_batches(id) NOT NULL
quantity           INT NOT NULL DEFAULT 1 CHECK (quantity BETWEEN 1 AND 10)
buyer_name         TEXT NOT NULL
buyer_email        TEXT NOT NULL
buyer_phone        TEXT NOT NULL
subtotal_php       INT NOT NULL
payment_provider   TEXT NOT NULL DEFAULT 'paymongo'
payment_method     TEXT NOT NULL CHECK (payment_method IN ('gcash','maya','card'))
payment_ref        TEXT                                 -- PayMongo session id
payment_status     TEXT NOT NULL DEFAULT 'pending'
                   CHECK (payment_status IN ('pending','paid','failed'))
success_token      TEXT NOT NULL                        -- nonce for anon success-page lookup
created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
paid_at            TIMESTAMPTZ
```

### 3.2 Reused tables

- `bookings` — voucher redemption inserts a row with `stay_type='voucher'`, `booking_flow='voucher'` (scaffolding already exists). Guest identity is stored in a new `guest_name_snapshot` column (nullable, added by migration; used only for anonymous voucher redemptions).
- `webhook_events` — new `provider='paymongo_voucher'` rows for idempotency on the voucher-webhook edge function.
- `host_wallets` / `wallet_ledger_entries` — credited via existing `credit-host-wallet` logic.
- `platform_revenue_events` — NEW table (created by the same migration): `id UUID PK, source TEXT NOT NULL, amount_php INT NOT NULL, voucher_id UUID FK vouchers(id) NULL, occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()`. Sole source at ship time is `source='voucher_expired'`; the table is intentionally generic so future revenue sources (fees, no-show retention, etc.) can append rows without a schema change.

### 3.3 Code format

`CS-XXXX-XXXX` — 8 alphanumeric chars after prefix, uppercase, Crockford base32 (no `0/O/1/I/L`). Generated via `crypto.getRandomValues`. On unique-index collision, regenerate up to 5 times.

---

## 4. Flows

### 4.1 Purchase (anonymous)

1. Visitor on `/vouchers` picks a batch → `/vouchers/[batch_id]`.
2. Fills form: name, email, phone, payment method (gcash/maya/card), **rules checkbox** ("Non-refundable. Valid until [date]. Redeem at the property.").
3. `POST /functions/v1/create-voucher-checkout` (anonymous). Validates via Zod, checks batch `is_active` and has stock (unclaimed count < quantity), inserts `voucher_purchases` (`status='pending'`, minted `success_token`), creates PayMongo checkout session with `success_url=/vouchers/success?purchase=[id]&token=[success_token]`, returns `{ checkout_url }`.
4. Buyer completes payment on PayMongo → redirect to `/vouchers/success`.
5. `voucher-webhook` fires: verifies PayMongo signature, checks `webhook_events` idempotency, marks purchase `paid`, mints `quantity` codes with unique-collision retry, inserts `vouchers` rows with `valid_until = paid_at + batch.valid_days`, sends email via Resend, dispatches admin notification.
6. Success page reads `purchase_id + success_token` via a lookup edge function (`get-voucher-purchase-public`), polls until `status='paid'`, then renders codes + resend button.

### 4.2 Redemption (host at check-in)

1. Host on `/host/redeem-voucher`: picks listing (their own), enters code, picks check-in date. Check-out auto-computed from `batch.nights`.
2. Preview card fetched via `host-preview-voucher` (authenticated, host-scoped RLS on `vouchers`): shows batch name, price, nights, buyer name, `valid_until`.
3. Host clicks **Confirm redemption** → `host-redeem-voucher`.
4. Edge function validates: caller is `host` (via `has_role`), code exists, `status='unclaimed'`, `valid_until > now()`, batch's listing matches selected listing, host owns that listing. Failures return specific 400 errors:
   - `"This voucher is for a different property."`
   - `"Voucher already redeemed."`
   - `"Voucher expired."`
   - `"You do not host this listing."`
5. On success — all within a Postgres transaction via RPC:
   1. Insert `bookings` (`stay_type='voucher'`, `booking_flow='voucher'`, `status='confirmed'`, `payment_status='paid'`, `total_php=batch.price_php`, `check_in`, `check_out=check_in + nights`, `guest_id=NULL`, `guest_name_snapshot=voucher_purchases.buyer_name`).
   2. Update `vouchers`: `status='claimed'`, `booking_id`, `redeemed_by_host_id`, `redeemed_at`.
   3. Credit the host wallet through the standard booking pipeline: the newly-inserted booking (`payment_status='paid'`, `status='confirmed'`) is picked up by the existing `credit-host-wallet` mechanism (10%/90% split to `host_wallets.pending_balance`), and `release-pending-balance` moves the funds to `available_balance` 1 day after check-out. No voucher-specific wallet path — voucher bookings look like normal paid bookings to the wallet system.
6. Admin notification: "Voucher [code] redeemed by [host] at [listing]."
7. Optional: email the buyer "Voucher redeemed" confirmation (if `buyer_email` still valid).

### 4.3 Expiry (scheduled)

- pg_cron job `cheapstays-voucher-expiry` runs every 6 hours.
- `UPDATE vouchers SET status='expired' WHERE status='unclaimed' AND valid_until < now() RETURNING id, batch_id`.
- For each newly-expired voucher, insert a `platform_revenue_events` row (`amount = batch.price_php`, `source='voucher_expired'`, `voucher_id`, `at=now()`).
- Admin dashboard purchases table shows expired vouchers with an "Expired" status pill.

### 4.4 Money flow summary

| Event | PayMongo balance | Platform ledger | Host wallet |
|---|---|---|---|
| Buyer pays | +₱X | — | — |
| Voucher redeemed | — | debit -₱X (moves to booking accounting) | +₱X × 0.9 pending; released 1d after check-out |
| Voucher expires | — | credit +₱X × 1.0 (revenue) | — |

---

## 5. Edge Functions

| Function | Auth | Rate limit | Purpose |
|---|---|---|---|
| `create-voucher-checkout` | Anonymous | 10 req/60s per IP | Zod-validate buyer info; check batch active + has stock; create PayMongo session; insert `voucher_purchases` row (`status='pending'`, minted `success_token`); return `{ checkout_url }`. |
| `voucher-webhook` | PayMongo signature | — | Idempotent via `webhook_events`; mint codes; email via Resend; notify admins. |
| `get-voucher-purchase-public` | Anonymous (validates `success_token`) | 30 req/60s | Success page lookup: returns purchase status + codes if `paid`. |
| `resend-voucher-email` | Anon (with token) or admin | 5 req/60s per purchase | Re-send code email. |
| `admin-create-voucher-batch` | Admin only | 30 req/60s | Insert `voucher_batches` row after Zod validation. |
| `admin-deactivate-voucher-batch` | Admin only | 30 req/60s | Set `is_active=false` — batch disappears from public browse and blocks new purchases. **Already-purchased vouchers remain valid until their own `valid_until`; deactivation does not expire them.** |
| `host-preview-voucher` | Host only | 20 req/60s | Return batch + buyer name for the host redeem preview card. Host-owns-listing enforced. |
| `host-redeem-voucher` | Host only | 20 req/60s | Transactional redemption via RPC. |

All functions follow existing conventions: `_shared/cors.ts`, `getUserFromRequest`, `await rateLimit(...)`, Zod body validation.

---

## 6. UI

### 6.1 Folder placement

```
src/pages/
├── vouchers/                         (NEW public)
│   ├── VouchersIndex.tsx             /vouchers
│   ├── VoucherDetailPage.tsx         /vouchers/[batch_id]
│   └── VoucherSuccessPage.tsx        /vouchers/success
├── admin/
│   └── VouchersPage.tsx              /admin/vouchers  (tabs: Batches / Purchases)
└── host/
    └── RedeemVoucherPage.tsx         /host/redeem-voucher

src/components/vouchers/              (NEW folder — mirrors src/components/wallet/)
├── VoucherCard.tsx
├── VoucherPurchaseForm.tsx
├── VoucherCodeDisplay.tsx
├── AdminVoucherBatchForm.tsx
├── AdminVoucherBatchList.tsx
├── AdminVoucherPurchasesTable.tsx
└── HostRedeemForm.tsx

src/types/vouchers.ts                 (NEW — mirrors src/types/wallet.ts)
```

### 6.2 Public

- **Homepage:** new `<VoucherDealsSection>` inserted in `src/pages/Index.tsx` between the hero and Featured Stays. Horizontal carousel of active batches. Hidden if no active batches.
- **Navbar:** new "Vouchers" nav link → `/vouchers`.
- **`/vouchers`:** grid of `<VoucherCard>` with city/price/type filters. Empty state: "No voucher deals right now — check back soon."
- **`/vouchers/[batch_id]`:** listing hero + description on the left; deal + `<VoucherPurchaseForm>` on the right. Sold-out state when 0 unclaimed.
- **`/vouchers/success`:** polls purchase status via `get-voucher-purchase-public`. On `paid`: big check + `<VoucherCodeDisplay>` (monospace + copy) + valid-until + resend-email button + instructions ("Show this code to the host at check-in at [Listing, City].").

### 6.3 Admin

- **`/admin/vouchers`** with `<Tabs>`:
  - **Batches tab:** "Create voucher batch" button → dialog with `<AdminVoucherBatchForm>` (listing dropdown, name, nights, price, quantity, valid_days, terms, is_active). Table below: Listing / Name / Price / Nights / Quantity / Sold / Valid days / Active / Actions.
  - **Purchases tab:** `<AdminVoucherPurchasesTable>` — Buyer / Email / Phone / Batch (listing) / Purchased at / Codes / Status pill / Actions (resend email, view redemption booking).
- **Sidebar:** add "Vouchers" nav item.

### 6.4 Host

- **`/host/redeem-voucher`:** `<HostRedeemForm>`. Listing dropdown → code input (auto-format `CS-XXXX-XXXX`) → check-in date → preview card via `host-preview-voucher` → **Confirm redemption**. On success: toast + redirect to `/host/bookings/[booking_id]`. On failure: inline error.
- **Sidebar:** add "Redeem voucher" nav item.

---

## 7. Security & RLS

Following the CLAUDE.md §17 rule: all new RLS uses `public.has_role(auth.uid(), 'admin' | 'host')`, never `auth.jwt() ->> 'role'`.

| Table | Policy | Applies to |
|---|---|---|
| `voucher_batches` | `SELECT` where `is_active = true` | `anon`, `authenticated` |
| `voucher_batches` | `SELECT/INSERT/UPDATE` all | admin |
| `vouchers` | `SELECT` where batch's listing's `host_id = auth.uid()` **and** `has_role(auth.uid(), 'host')` | host (for preview page) |
| `vouchers` | `SELECT/UPDATE/DELETE` all | admin |
| `vouchers` | (no anon/user policy — access only via edge functions) | — |
| `voucher_purchases` | `SELECT` all | admin |
| `voucher_purchases` | (no anon/user policy — anonymous lookup goes through `get-voucher-purchase-public` which verifies `success_token`) | — |

**Code security:**
- `crypto.getRandomValues` → Crockford base32 → `CS-XXXX-XXXX` (~40 bits entropy).
- Unique index on `vouchers.code`; regenerate on collision up to 5 attempts.
- Codes are never logged. Admin purchases table masks middle chars unless the row is expanded.

**Anti-abuse:**
- Rate limits per §5 above.
- Batch stock is enforced server-side by counting `unclaimed` vouchers at checkout-creation time (not on the batch row directly, to avoid races between multiple pending checkouts). Overbooking is prevented by re-checking stock at webhook-code-mint time; if stock is exhausted between checkout and payment, refund is triggered via PayMongo API and buyer is emailed a "we couldn't process your voucher — refunded" message.

---

## 8. Testing

### Vitest (`src/test/`)

- `voucher-batch.test.ts` — admin batch creation validates nights ≥1, price >0, quantity 1–500, valid_days 1–14.
- `voucher-checkout.test.ts` — rejects if batch inactive or out of stock; Zod validates buyer fields; success_token minted and stored.
- `voucher-webhook.test.ts` — idempotent (double webhook fires generate codes once); generates exactly `quantity` codes; correct `valid_until`; handles unique-code collision retry.
- `voucher-redeem.test.ts` — rejects wrong listing / expired code / already-claimed code / not-host-owns-listing; on success creates booking with correct `stay_type='voucher'`, updates voucher status, credits wallet.
- `voucher-expire.test.ts` — expires only past-`valid_until` unclaimed vouchers; records `platform_revenue_events` row.
- `voucher-purchase-form.test.tsx` — rules checkbox required; validation errors shown for missing fields.
- `host-redeem-form.test.tsx` — code format auto-uppercase; preview call error surfaces inline.

### Playwright E2E (`e2e/`)

- `voucher-purchase.spec.ts` — anon `/vouchers` → pick batch → complete purchase (PayMongo mocked) → see code on success page → email link works.
- `voucher-redeem.spec.ts` — host signs in → `/host/redeem-voucher` → enters code → confirms → sees new booking in bookings list.
- `admin-vouchers.spec.ts` — admin creates a batch → appears in `/vouchers` → after a purchase, appears in purchases table.

---

## 9. Documentation Deliverables

Post-implementation edits to `CLAUDE.md`:

- **§4.10 Voucher Functions:** register the 8 new edge functions.
- **§5 Key Tables:** add rows for `voucher_batches`, `vouchers`, `voucher_purchases`, and `platform_revenue_events`.
- **§17 Trip-wires:** three new entries:
  - Don't INSERT `voucher_purchases` from the client — always via edge function so `success_token` is server-generated and PayMongo session is verifiable.
  - Redemption must happen inside a single RPC transaction (voucher status update, booking insert, wallet credit — all or nothing).
  - Voucher batch stock must be re-checked at webhook mint time, not just at checkout creation, to prevent races between concurrent pending purchases.

---

## 10. Out of Scope

- Host proposing / approving their own voucher batches — admin-only for MVP.
- Buyer accounts, wishlists, or a "My Vouchers" page — anonymous, no login.
- QR-code presentation at check-in — plain code only for MVP.
- Multi-quantity buying above 10 per purchase — capped to prevent abuse.
- Percent-off / gift-card style vouchers — explicitly not this feature.
- Automated buyer refunds — all sales final; admins handle exceptions manually via PayMongo dashboard.
