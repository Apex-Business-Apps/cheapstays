# CheapStays Platform

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.2.0  
**Last Updated:** 2026-05-21

CheapStays is a Vite + React + TypeScript web platform for short-term rental discovery, booking, host onboarding, payment processing, support ticketing, and AI concierge interactions, backed by Supabase for authentication, RBAC, RLS-protected data access, and edge functions.

## System Status

Current delivery status and release notes are maintained in:

- [`docs/STATUS.md`](docs/STATUS.md)

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project access (URL + anon key for app runtime)
- Supabase admin access for migrations

### Local Setup

```bash
npm install
npm run dev
```

Application runs locally on the Vite default port.

### Build & Test

```bash
npm run build
npm run test
```

## Documentation Index

- **Onboarding Guide:** [`docs/ONBOARDING.md`](docs/ONBOARDING.md)
- **Operations Runbook:** [`docs/RUNBOOK.md`](docs/RUNBOOK.md)
- **Platform Status:** [`docs/STATUS.md`](docs/STATUS.md)
- **Change Log:** [`docs/CHANGELOG.md`](docs/CHANGELOG.md)
- **Versioning Standard:** [`docs/VERSIONING.md`](docs/VERSIONING.md)

## Security & Access Model (Summary)

- Supabase Auth governs identity.
- Role model: `admin`, `host`, `member`, `user`.
- RLS policies enforce least privilege over:
  - `user_roles`
  - `support_tickets`
  - `support_messages`
  - `concierge_requests`
  - `host_profiles`
  - `listings`
  - `bookings`
  - `reviews`
- Admin dashboard enables role grant/revoke workflows with audit logging.
- Listings are publicly readable when published; creation requires the `host` role.
- Bookings and reviews are accessible only to the owner or authenticated parties per policy.

## Payment Integration

Payments are processed via PayMongo and support GCash, Maya, and card methods. The `payment-intent` edge function handles payment intent creation and is invoked from the booking flow in `Membership.tsx`.

The platform operates in demo mode until `PAYMONGO_SECRET_KEY` is configured in Supabase Edge Function secrets. In demo mode, bookings are set to `confirmed` immediately without real payment processing. No money movement occurs in demo mode.

To enable live payments:

1. Add `PAYMONGO_SECRET_KEY` to Supabase Edge Function secrets (Project Settings > Edge Functions > Secrets).
2. Redeploy the `payment-intent` function.
3. Confirm end-to-end test payment before going live.

See `docs/RUNBOOK.md` section 7 for the full go-live checklist.

## Deployment Overview

- Frontend: Cloudflare Pages (`cheapstays` project).
- Domain targets: `cheapstays.me` and `www.cheapstays.me`.
- Backend: Supabase project (`muqdmvkapsxrsgdkfoxn`).
- Database migrations must be applied before deploying a new frontend version. Use `supabase db push` (Supabase CLI), the helper script at `supabase/scripts/apply_migration.py`, or the Supabase Management API. See `docs/RUNBOOK.md` section 5 for details.
- Cloudflare Pages does not auto-deploy on GitHub merge. Every production release requires manual execution of `npm run release:production`.

## Maintenance Policy

- Update version/date headers in `README.md`, `docs/STATUS.md`, `docs/ONBOARDING.md`, and `docs/RUNBOOK.md` for every operationally relevant change.
- Add a status entry for every migration that affects RLS/authz behavior.
