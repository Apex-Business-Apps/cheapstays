# CHANGELOG

**Organization:** JGP Corporation  
**Location:** Pasig City, Metro Manila, Philippines  
**Document Version:** 1.2.1  
**Last Updated:** 2026-05-25

All notable changes to this project are documented in this file.

Format guidance follows Keep a Changelog principles and semantic release headings.

## [1.2.1] - 2026-05-25

### Added

- `supabase/functions/paymongo-webhook/index.ts` — isolated PayMongo webhook receiver for `checkout_session.payment.paid`.
- `supabase/functions/_shared/paymongo-webhook.ts` — reusable parser/signature helpers for PayMongo webhook handling.
- `src/test/paymongo-webhook-helpers.test.ts` — focused unit tests for parsing, metadata extraction, and signature verification.
- `docs/PAYMONGO_WEBHOOK_SETUP.md` — deployment and operations guide for webhook setup.

### Changed

- `docs/API.md`, `docs/ARCHITECTURE.md`, and `docs/STATUS.md` updated to reflect webhook lifecycle, required secrets, and operational risks.


## [1.1.0] - 2026-05-21

### Security

- Replaced invalid `auth.getClaims()` with `auth.getUser()` in `supabase/functions/_shared/auth.ts` (BUG-002).
- AI chat bubble now derives function URL from `VITE_SUPABASE_URL` instead of potentially undefined `VITE_SUPABASE_PROJECT_ID` (BUG-004).
- Self-booking rejected at `book-listing` edge function — hosts cannot book their own listings (BUG-007).
- Google OAuth button disabled during sign-in to prevent double-click race conditions (BUG-012).
- High npm audit vulnerabilities resolved via `npm audit fix` (rollup, yaml, wrangler/ws devDependencies).
- ErrorBoundary hides raw error details in production; resets on route change (BUG-013).
- Payment-webhook uses constant-time HMAC comparison; requires webhook secret in production.
- `_shared` changes in CI now redeploy all edge functions.

### Fixed

- `/search` page crash when `browseListings` was undefined — added mount fetch for latest 12 active listings (BUG-001).
- Agoda search imported non-existent `checkRateLimit`; corrected to exported `rateLimit` (BUG-005).
- Review form shown for non-completed bookings; now gated on `eligibleBookingId` from completed bookings only (BUG-006).
- `GuestRatingBadge` now uses 5-minute TTL module-level cache to prevent stale data and excessive fetches (BUG-009).
- Toast system standardized on Sonner; `use-toast.ts` is a thin shim, `toaster.tsx` uses `<SonnerToaster>` (BUG-010).

### Added

- `supabase/functions/assign-member-role/index.ts` — service-role edge function for membership role upsert (BUG-008).
- `/listing/slug/:slug` route in App.tsx; `ListingDetail.tsx` fetches by slug when param is present (BUG-016).
- `supabase/migrations/20260521220000_fix_reviews_booking_unique.sql` — unique index on `(booking_id, reviewer_role)` for two-way ratings.
- `supabase/migrations/20260521230000_rate_limit_table.sql` — persistent `rate_limits` table for cross-instance rate limiting.
- `supabase/migrations/20260521240000_listings_images_text_array.sql` — ensures `images` column is `TEXT[]` with `'{}'` default.
- `supabase/migrations/20260521260000_notifications.sql` — `notifications` table with RLS, booking status trigger.
- `public/sitemap.xml` — static sitemap with all primary routes.
- `public/robots.txt` — standard allow-all with sitemap reference.
- `supabase/scripts/generate-sitemap.ts` — automated sitemap generation script.
- `npm run typecheck` script added to `package.json` and PR CI workflow.
- `npm run generate:sitemap` script added to `package.json`.
- SEO: `Seo.tsx` supports `jsonLd` prop for JSON-LD structured data injection.
- Mobile hamburger nav added to `Navbar.tsx`.
- `docs/SEO_SITEMAP.md`, `docs/NOTIFICATIONS.md`, `docs/RESPONSIVE_UX.md` created.
- `.env.example` with required environment variable keys.

### Changed

- Supabase types updated to include `bookings`, `reviews`, `host_profiles`, `notifications` tables and all missing enums.
- `listings` type updated with `video_url` column.
- PR CI workflow adds typecheck and test steps before build.
- Production deploy CI redeploys all functions when `_shared` directory changes.
- `Admin.tsx` corrected to query `display_name` instead of non-existent `business_name` on `host_profiles`.

## [1.2.0] - 2026-05-21

### Added

- `host_profiles` table with host verification workflow: states are `unverified`, `pending`, `verified`, and `rejected`. RLS enforced.
- `listings` table for property listings. RLS policy: anyone can read active listings; `host` role required to create. Supports instant book flag and draft/published states.
- `bookings` table for reservation records with date range tracking, payment status, and PayMongo payment reference storage. RLS enforced.
- `reviews` table for post-stay guest reviews, one review per booking. Database trigger updates `listings.avg_rating` on insert.
- `book-listing` edge function: creates bookings, validates date availability, and respects the instant book flag. Rate limit: 10 requests per minute per IP. JWT required.
- `payment-intent` edge function: creates PayMongo payment intents supporting GCash, Maya, and card payment methods. Rate limit: 5 requests per minute per IP. JWT required. Operates in demo mode when `PAYMONGO_SECRET_KEY` is not set in Supabase secrets.
- Seed data: 25 owner-direct Philippine property listings across 15 destinations (El Nido, Siargao, Bohol, Batanes, Vigan, Boracay, Baguio, Cebu, Coron, Tagaytay, Iloilo, Dumaguete, Camiguin, La Union, Davao). Price range: PHP 1,400 to PHP 6,200 per night.
- `Search.tsx` page: real database listing cards with booking modal invoking `book-listing`, skeleton loading states, and auth gate for unauthenticated users.
- `Host.tsx` page: full host onboarding flow with profile upsert to `host_profiles`, listing creation form with 12 amenity checkboxes, instant book toggle, draft/publish state, and AI description generator.
- `Membership.tsx` page: payment dialog supporting GCash, Maya, and card via `payment-intent`, feature comparison table, and testimonials section.
- Internationalization support for 9 languages: English, Filipino, Chinese Simplified, Malay, Indonesian, Korean, Vietnamese, Japanese, and Thai.
- Language switcher in navbar using a Globe icon with dropdown. All UI strings managed via react-i18next.
- Voice command support in Pip (AI concierge chat bubble) for navigation commands and language switching. Instant local response is returned before the LLM reply.

### Changed

- `ai-search` edge function now queries the real `listings` database table. Previously returned hallucinated listing data. City, price, and minimum nights filters are applied before Groq scoring.
- Badge labels across the UI updated to uppercase for visual consistency.
- `HERO_STAYS_COUNT` value is now read dynamically from the database rather than hardcoded.
- All user-visible text reviewed and humanized for tone consistency.

### Fixed

- Listing type enum mismatch between the host creation form and the database schema corrected.

### Security

- RLS policies applied to all new tables: `host_profiles`, `listings`, `bookings`, and `reviews`.
- Rate limiting applied to new edge functions: `book-listing` (10 req/min per IP) and `payment-intent` (5 req/min per IP).

## [1.0.0] - 2026-05-21

### Added
- RBAC admin dashboard capabilities for role grant/revoke operations and visibility into role audit logs and support tickets.
- Concierge request persistence model (`concierge_requests`) with RLS and operational indexes.
- Operational documentation set:
  - `docs/ONBOARDING.md`
  - `docs/RUNBOOK.md`
  - `docs/STATUS.md`
  - `docs/VERSIONING.md`

### Changed
- Hero carousel expanded to include eight additional city destination slides while preserving existing motion behavior.
- RLS policies hardened for support ticket updates and support message inserts.
- Top-level README replaced with versioned operational/project documentation.

### Security
- Enforced stricter RLS write-time checks for support and concierge workflows.
- Standardized least-privilege token guidance for Cloudflare deployment operations.
