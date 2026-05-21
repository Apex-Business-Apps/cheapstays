# CheapStays Platform

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.0.0  
**Last Updated:** 2026-05-21

CheapStays is a Vite + React + TypeScript web platform for travel discovery, booking-adjacent user journeys, support ticketing, and AI concierge interactions, backed by Supabase for authentication, RBAC, RLS-protected data access, and edge functions.

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
- Admin dashboard enables role grant/revoke workflows with audit logging.

## Deployment Overview

- Frontend: Cloudflare Pages (`cheapstays` project).
- Domain targets: `cheapstays.me` and `www.cheapstays.me`.
- Backend: Supabase project (`muqdmvkapsxrsgdkfoxn`).

## Maintenance Policy

- Update version/date headers in `README.md`, `docs/STATUS.md`, `docs/ONBOARDING.md`, and `docs/RUNBOOK.md` for every operationally relevant change.
- Add a status entry for every migration that affects RLS/authz behavior.
