# CHEAPSTAYS PHASE 0 — BASELINE DISCOVERY & DRIFT LOCK

**Produced:** 2026-06-20  
**Branch / Commit:** main (unmodified — read-only phase)  
**Purpose:** Lock the implementation baseline before any product code changes.

---

## 1. Detected Stack

| Dimension | Value |
|---|---|
| Package manager | npm (`package-lock.json` present) |
| Framework | Vite + React 18 + TypeScript 5.8 |
| UI library | shadcn/ui (Radix UI primitives) + TailwindCSS 3 |
| Routing | react-router-dom v6 (lazy-loaded pages) |
| Auth | Supabase Auth (`@supabase/supabase-js`) via `useAuth` hook |
| Role system | `user_roles` table + `has_role()` DB function; roles: `admin`, `host`, `member`, `user` |
| Database client | `@supabase/supabase-js` (typed client at `src/integrations/supabase/client.ts`) |
| Migration system | Supabase CLI migrations (`supabase/migrations/`) — 44 files |
| Edge Functions | 43 Supabase Edge Functions (Deno) |
| Payments | PayMongo (primary, Philippine e-wallets), Xendit (disbursements), Stripe (memberships) |
| AI | Groq LLM (ai-search, ai-describe, ai-chat, support-stream) |
| Deployment | Cloudflare Pages (`wrangler`) |
| Test runner | Vitest (unit) + Playwright (E2E) |
| i18n | react-i18next |
| State management | React state + TanStack Query v5 |

---

## 2. Current Route Map

| Route | Component | Auth Guard |
|---|---|---|
| `/` | `Index.tsx` | Public |
| `/auth` | `Auth.tsx` | Public |
| `/search` | `Search.tsx` | Public (AI search rate-limited for non-members) |
| `/membership` | `Membership.tsx` | Public |
| `/host` | `Host.tsx` | Authenticated → host role check internal |
| `/host/apply` | `HostApply.tsx` | Authenticated |
| `/host/wallet` | `host/WalletPage.tsx` | Authenticated + host |
| `/support` | `Support.tsx` | Public |
| `/my-bookings` | `MyBookings.tsx` | Authenticated |
| `/notifications` | `Notifications.tsx` | Authenticated |
| `/admin` | `Admin.tsx` | Authenticated + admin role check internal |
| `/listing/:id` | `ListingDetail.tsx` | Public |
| `/listing/slug/:slug` | `ListingDetail.tsx` | Public |
| `/booking-success` | `BookingConfirmationSuccess.tsx` | Public |
| `/privacy` | `LegalDocumentPage` | Public |
| `/terms` | `LegalDocumentPage` | Public |
| `/host-terms` | `LegalDocumentPage` | Public |
| `/renter-rules` | `LegalDocumentPage` | Public |
| `/refunds` | `LegalDocumentPage` | Public |
| `/safety` | `LegalDocumentPage` | Public |
| `/account-deletion` | `LegalDocumentPage` | Public |
| `/legal` | `LegalDocumentPage` | Public |
| `/legal/accept` | `LegalAcceptance.tsx` | Authenticated |
| `/support-policy` | `LegalDocumentPage` | Public |

**MISSING routes per PPTX:**
- `/types-of-stays` — does NOT exist
- `/become-a-partner` — does NOT exist (closest is `/host`)
- `/about` — does NOT exist

---

## 3. Current Database Entities

### Core Tables (from migrations)
| Table | Key Columns | Notes |
|---|---|---|
| `listings` | `id, host_id, title, slug, type (enum), city, province, nightly_php, min_nights, amenities, images, instant_book, status, short_term_enabled, long_term_enabled, max_nights` | `type` enum is legacy: `entire_place, private_room, shared_room, glamping, villa, resort`. No hourly pricing columns yet. |
| `bookings` | `id, listing_id, guest_id, host_id, check_in, check_out, nights, total_php, status, payment_status, stay_type, booking_flow, flow_state` | `stay_type`: `short_term/long_term`. No `hourly` mode yet. No `voucher` booking mode. |
| `host_profiles` | `id, user_id, display_name, bio, phone, verification_status` | Present and functional |
| `reviews` | `id, booking_id, listing_id, reviewer_id, rating, body` | Present and functional |
| `host_applications` | `id, user_id, status, property_type, city` | Status: `pending, approved, rejected, manual_review` |
| `support_tickets` | `id, ticket_num, subject, status, priority, category, escalated` | Fully functional |
| `support_messages` | `id, ticket_id, sender, content` | Functional |
| `host_wallets` | `id, host_id, available_balance, pending_balance, currency, is_frozen` | Present |
| `wallet_transactions` | `id, wallet_id, type, amount, booking_id` | Immutable ledger |
| `disbursement_requests` | `id, wallet_id, amount, status, payout_method, cycle_month` | Monthly payout cycle |
| `host_payout_accounts` | `id, host_id, payout_method, account_holder_name, account_number_enc` | Encrypted payout account |
| `user_roles` | `id, user_id, role` | Roles: admin, host, member, user |
| `profiles` | `user_id, display_name` | User profile |
| `booking_transitions` | `id, booking_id, from_state, to_state, actor_role` | Immutable audit trail |
| `notifications` | Standard push notification table | Present |
| `role_mutation_audit` | Immutable audit for role changes | Present |
| `user_suspensions` | Admin suspension system | Present |
| `membership_subscriptions` | Stripe membership table | Present |

### MISSING Tables (PPTX required):
- `vouchers` — no voucher table exists
- `promos` — no promo/discount code table
- `listing_hourly_pricing` — no hourly pricing table or columns

### Missing Columns on `listings`:
- `stay_availability_type` (hourly / overnight / both)
- `stay_category` (quick_stay, hourly_stay, overnight_stay, hostel, private_pool, condo, apartment, hotel_room, motel_room)
- `booking_mode` (instant / voucher / manual_review)
- `hourly_php` — hourly price
- `price_3h` — 3-hour block price
- `price_6h` — 6-hour block price
- `price_12h` — 12-hour block price
- `overnight_php` — maps from `nightly_php` (must backfill, not rename)
- `promo_price` — voucher/promo price

---

## 4. Current Host / Admin / Payment / Support Flows

### Host Flow
- **Entry:** `/host` → if no host role, shows `HostApplicationForm`
- **Application:** Submits support ticket (category: `host_verification`) + upserts `host_profiles`
- **Portal tabs:** Dashboard, Calendar, Long-term requests, Blackouts, New listing, My listings, Bookings
- **Listing creation:** Creates with `nightly_php`, `type` (legacy enum), `status: draft`, then publish gate
- **Publish gate:** `ListingPublishGate` checks 3-month availability, blackouts, house rules, stay instructions
- **Wallet:** `/host/wallet` → `WalletPage.tsx` (exists, 532 bytes, minimal stub)
- **MISSING:** Voucher redemptions tab, Payouts tab, Profile/Settings tab

### Admin Flow
- **Entry:** `/admin` → role check (admin only)
- **Tabs:** Applications, Bookings, Users, Users & Roles, Support, Audit log
- **Finance/Disbursements:** `AdminDisbursementPanel` component referenced but rendered under `value="disbursements"` tab — **BUG**: TabsTrigger for `disbursements` value is MISSING from TabsList (unreachable UI)
- **MISSING tabs per PPTX:** Dashboard overview, Listings (full), Finance (exposed), Settings

### Payment Flow
- **PayMongo:** `payment-intent` edge function creates payment intent; `paymongo-webhook` handles webhooks; `capture-booking-payment` captures after auth
- **Stripe:** `membership-payment-intent` + `membership-webhook` for memberships
- **Xendit:** `xendit-disbursement-webhook` for host payouts
- **Refunds:** `process-refund` edge function exists
- **Status:** `payment_status` enum: `unpaid, pending, paid, failed, refunded`; `payment_state` enum extended with `expired`

### Support Flow
- `support-ticket` edge function creates tickets
- `support-message` edge function sends messages
- `support-stream` edge function for AI streaming support
- AI chat via `ai-chat` edge function + `AiChatBubble` component
- Full thread view in admin

---

## 5. Current Validation Status

| Gate | Status | Evidence |
|---|---|---|
| `npm install` | PASS (node_modules present) | `node_modules/` exists |
| `npm run typecheck` | ✅ PASS (exit 0) | `tsc -p tsconfig.app.json --noEmit` clean |
| `npm run lint` | ⚠️ WARNINGS ONLY (exit 0) | 10 warnings, 0 errors; all are `react-refresh/only-export-components` or `react-hooks/exhaustive-deps` in shadcn generated code |
| `npm run build` | NOT RUN (deferred to Phase 8) | — |
| `npm run test` | NOT RUN (deferred to Phase 8) | — |
| `npm run e2e` | NOT RUN (deferred to Phase 8) | — |

### Lint Warnings (baseline, pre-modification)
```
src/components/CardHoldForm.tsx:70:6  — useEffect missing dependency 'initSdk'
src/components/HeroCarousel.tsx:37:14 — Fast refresh: exports non-component
src/components/ui/badge.tsx:29:17    — Fast refresh: exports non-component
src/components/ui/button.tsx:47:18   — Fast refresh: exports non-component
src/components/ui/form.tsx:129:10    — Fast refresh: exports non-component
src/components/ui/navigation-menu.tsx:111:3 — Fast refresh
src/components/ui/sidebar.tsx:636:3  — Fast refresh
src/components/ui/sonner.tsx:27:19   — Fast refresh
src/components/ui/toggle.tsx:37:18   — Fast refresh
src/hooks/useAuth.tsx:125:14         — Fast refresh
```
All pre-existing. None introduced by PPTX work.

---

## 6. Environment File Handling

| File | Status |
|---|---|
| `.env` | Present (353 bytes) — contains real values — NEVER printed/logged |
| `.env.example` | Present (2451 bytes) — contains safe placeholders only ✅ |
| `.gitignore` | Does NOT explicitly ignore `.env` — **RISK**: `.env` could be committed if not careful |

> **⚠️ RISK:** `.gitignore` ignores `*.local` but not `.env` directly. This is a pre-existing risk. This phase does not modify `.gitignore`.

---

## 7. PPTX Drift Risk Assessment

### Missing Public Routes
| PPTX Route | Status | Risk |
|---|---|---|
| `/types-of-stays` | MISSING | Phase 3: create new page |
| `/become-a-partner` | MISSING (exists at `/host`) | Phase 3: add alias route or redirect |
| `/about` | MISSING | Phase 3: create new page |
| `/` | EXISTS | Home needs PPTX sections added |
| `/search` | EXISTS | Needs stay-type filter integration |
| `/support` | EXISTS | Needs PPTX content sections |

### Missing Domain Concepts
| Concept | Status | Phase |
|---|---|---|
| Hourly stay pricing | MISSING schema | Phase 1 |
| Stay availability type (hourly/overnight/both) | MISSING | Phase 1 |
| Stay category taxonomy (quick_stay, etc.) | MISSING | Phase 1 |
| Booking mode (voucher, manual_review) | PARTIAL (instant/request exists) | Phase 1 |
| Voucher lifecycle | MISSING — no `vouchers` table | Phase 1 |
| Promo codes | MISSING | Phase 7 |
| Popular Cities (Cubao/Manila/Makati/QC/Pasay/Taguig) | HOME missing these | Phase 3 |
| Quick Stay Vouchers section on home | MISSING | Phase 3 |

### Admin Gaps
| PPTX Requirement | Status |
|---|---|
| Listings tab in admin | MISSING |
| Finance/Payouts tab (exposed) | EXISTS but UNREACHABLE (bug in TabsList) |
| Settings tab | MISSING |
| Admin Dashboard overview | EXISTS as header stats |
| Hosts tab | MISSING (host apps exist but no hosts-only view) |

### Host Portal Gaps
| PPTX Requirement | Status |
|---|---|
| Payouts tab | MISSING (wallet at separate route `/host/wallet`) |
| Voucher Redemptions tab | MISSING |
| Profile/Settings tab | MISSING |
| Availability Calendar block/available/maintenance | PARTIAL (blackouts exist) |

---

## 8. Safe Implementation Strategy

### Principle: Additive, Surgical, Preserve-First

1. **Never rename** `nightly_php` — add `overnight_php` alias column, backfill from `nightly_php`
2. **Never drop** existing `listing_type` enum — add new `stay_category` text column alongside it
3. **Never change** existing booking flow — add `booking_mode` column alongside `booking_flow`
4. **Vouchers** → add new `vouchers` table (no risk to existing booking table)
5. **Admin `disbursements` tab** → fix the missing `TabsTrigger` (one-line bug fix)
6. **Host portal** → add tabs within existing Host.tsx Tabs component
7. **New routes** (`/types-of-stays`, `/become-a-partner`, `/about`) → new page files + `App.tsx` additions

### Migration Safety Rules
- All new columns: `IF NOT EXISTS`, `DEFAULT` provided, no immediate `NOT NULL` without backfill
- No `DROP COLUMN` or `RENAME COLUMN`
- All new tables: `IF NOT EXISTS`
- All new RLS policies: `DROP POLICY IF EXISTS` before `CREATE POLICY`
- Existing RLS: preserved unless additive extension is needed

---

## 9. Next Phase Safety

Phase 1 (Schema, Types, and Domain Foundation) is **SAFE TO BEGIN**.

Pre-conditions satisfied:
- ✅ Typecheck passes (0 errors)
- ✅ Lint passes (0 errors, 10 pre-existing warnings)
- ✅ No migration conflicts detected
- ✅ `.env` not printed or modified
- ✅ No destructive commands run
- ✅ Baseline drift map complete

---

*Phase 0 complete. Proceed to Phase 1.*
