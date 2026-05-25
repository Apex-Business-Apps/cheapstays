# Platform Status

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.2.1  
**Status Date:** 2026-05-25  
**Service State:** Operational with noted risks

## Environment Matrix

| Environment | Frontend | Backend | Auth | RBAC Admin | RLS Coverage | Notes |
|---|---|---|---|---|---|---|
| Production | Cloudflare Pages | Supabase | Enabled | Enabled | Enabled | Domain and cert propagation must be monitored after DNS edits |
| Local Dev | Vite Dev Server | Supabase (remote/local) | Enabled | Enabled (admin role required) | Enabled | Requires env configuration |

## Current Capability Snapshot

- RBAC admin dashboard for role management and support/audit visibility.
- Hero carousel expanded with 15 Philippine destination slides.
- `concierge_requests` table with RLS and audit-oriented schema.
- Support RLS hardened for update/insert ownership/admin checks.
- Live authorization smoke test executed for admin/non-admin flows.
- `host_profiles` table with verification workflow (unverified/pending/verified/rejected) and RLS.
- `listings` table with RLS, instant book support, draft/published states, and dynamic avg_rating via trigger.
- `bookings` table with date availability validation, payment status tracking, and PayMongo reference storage.
- `reviews` table with one-review-per-booking enforcement and automated rating aggregation.
- `book-listing` edge function with date conflict detection, instant book logic, JWT auth, and rate limiting.
- `payment-intent` edge function for GCash, Maya, and card payments via PayMongo. Operates in demo mode when secret key is not configured.
- `paymongo-webhook` edge function for checkout-session payment confirmation (`checkout_session.payment.paid`) with signature verification and event idempotency via `webhook_events`.
- `ai-search` edge function queries real listings data with city, price, and min_nights filters. Groq used for relevance scoring only.
- Host onboarding flow (profile creation, listing creation with 12 amenities, instant book toggle, draft/publish).
- 25 seed listings across 15 Philippine destinations. Price range PHP 1,400 to PHP 6,200 per night.
- Internationalization across 9 languages with navbar language switcher and voice command support in Pip.

## Known Risks / Tech Debt

1. **P1 - PayMongo demo mode active:** `PAYMONGO_SECRET_KEY` is not set in production Supabase secrets. The `payment-intent` function runs in demo mode, which sets bookings to confirmed without processing real payment. No real money movement occurs until the key is configured.
2. **P1 - Webhook dependency risk:** `paymongo-webhook` requires `PAYMONGO_WEBHOOK_SECRET` and dashboard event configuration. If missing or misconfigured, successful checkout payments may not reconcile to `payment_status = paid`.
3. **P2 - Manual Cloudflare deploy required:** Cloudflare Pages does not auto-deploy on GitHub merge. Every production release requires manual execution of `npm run release:production`. Risk of stale frontend if this step is missed.
4. **P3 - Bundle size warning:** Main JS bundle exceeds the 500KB warning threshold in production build. Code splitting has not been applied.
5. **Policy regression risk:** No automated CI database-level RLS test harness yet.
6. **Operational drift risk:** Manual role and token lifecycle processes need periodic review.

## Open Actions

| Priority | Action | Owner | Target Date | Status |
|---|---|---|---|---|
| P1 | Configure PAYMONGO_SECRET_KEY in Supabase secrets to enable live payment processing | Engineering | TBD | Open |
| P1 | Configure `PAYMONGO_WEBHOOK_SECRET` and register `checkout_session.payment.paid` on PayMongo dashboard for webhook reconciliation | Engineering | TBD | Open |
| P1 | Add automated RLS smoke tests to CI | Engineering | 2026-05-28 | Open |
| P2 | Set up Cloudflare Pages GitHub integration for auto-deploy on merge to main | Engineering | TBD | Open |
| P2 | Implement token rotation SOP checkpoint reminders | Operations | 2026-06-05 | Open |
| P3 | Add route-level/code-split optimization plan to reduce bundle size | Engineering | 2026-05-30 | Open |

## Recent Change Log

- **2026-05-25:** Added `paymongo-webhook` edge function, helper module, tests, and deployment/setup documentation.
- **2026-05-25:** Verified Omniport audit emitters are present in role mutation flows (`admin-role-mutation`, `omnihub-role-authority`) and synchronized this branch documentation with `main/omni-recall` governance assets (path: `/omni-recall`).
- **2026-05-21:** Released v1.2.0 with listings, bookings, payments, host onboarding, and i18n.
- **2026-05-21:** Added `host_profiles`, `listings`, `bookings`, `reviews` tables with RLS.
- **2026-05-21:** Deployed `book-listing` and `payment-intent` edge functions.
- **2026-05-21:** Updated `ai-search` to query real listings database table.
- **2026-05-21:** Added 25 seed listings across 15 Philippine destinations.
- **2026-05-21:** Added RBAC admin dashboard enhancements and role mutation workflow.
- **2026-05-21:** Introduced `concierge_requests` with RLS policies and indexes.
- **2026-05-21:** Hardened `support_tickets` and `support_messages` policy checks.
- **2026-05-21:** Completed live smoke validation for role and RLS boundaries.
