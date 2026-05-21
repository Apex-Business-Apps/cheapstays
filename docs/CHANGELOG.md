# CHANGELOG

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.2.0  
**Last Updated:** 2026-05-21

All notable changes to this project are documented in this file.

Format guidance follows Keep a Changelog principles and semantic release headings.

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
