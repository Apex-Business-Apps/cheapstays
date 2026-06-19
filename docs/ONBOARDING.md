# Engineering Onboarding Guide

**Organization:** JGP Corporation  
**Location:** Pasig City, Metro Manila, Philippines  
**Document Version:** 1.2.0  
**Last Updated:** 2026-05-21

## 1) Purpose

This guide onboards engineers to the CheapStays platform architecture, local setup, security model, and day-1 operational expectations.

## 2) Stack Overview

- Frontend: React + TypeScript + Vite + Tailwind/shadcn-ui.
- Backend/Data/Auth: Supabase (Postgres, Auth, Edge Functions).
- Hosting/CDN: Cloudflare Pages.

## 3) Repository Orientation

- `src/` → frontend application code.
- `supabase/migrations/` → database schema and policy migrations.
- `supabase/functions/` → edge functions for support/AI workflows.
- `docs/` → operations and governance documentation.

## 4) Required Access

- Git repository access (write on active branch as needed).
- Supabase project permissions:
  - read/write migrations (for DB maintainers)
  - auth admin access for controlled smoke tests
- Cloudflare access:
  - Pages edit permissions
  - DNS edit permissions for production zone updates (restricted scope)

## 5) Local Environment Setup

1. Install Node.js 20+.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure `.env` values (minimum):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Start app:
   ```bash
   npm run dev
   ```

## 6) Database Tables Reference

The following tables are live in the Supabase project as of v1.2.0:

| Table | Purpose | RLS |
|---|---|---|
| `user_roles` | RBAC role assignments | Enforced |
| `support_tickets` | Support request tracking | Enforced |
| `support_messages` | Messages within support tickets | Enforced |
| `concierge_requests` | AI concierge interaction log | Enforced |
| `host_profiles` | Host verification state (unverified/pending/verified/rejected) | Enforced |
| `listings` | Property listings (draft/published, instant book flag) | Enforced |
| `bookings` | Reservation records with payment tracking | Enforced |
| `reviews` | Post-stay reviews (one per booking, triggers avg_rating update) | Enforced |

### Running migrations locally vs production

When working against the remote Supabase project during development, apply migrations using the helper script:

```bash
python3 supabase/scripts/apply_migration.py <migration_file.sql>
```

For production releases, migrations should be applied deliberately and sequentially before deploying the frontend. See `docs/RUNBOOK.md` section 5 for all available options, including the Supabase CLI and Management API.

Do not apply migrations to production from a local branch that has not been code-reviewed and merged.

## 7) First Validation Checklist

Run:

```bash
npm run build
npm run test
```

Then verify:

- App loads and routes render.
- Non-admin cannot access admin actions.
- Admin can view role and support dashboards.

## 8) Security Responsibilities

- Never commit secrets.
- Use least-privilege API tokens.
- Validate RLS effects after every migration affecting authz.
- Record migrations and status impacts in `docs/STATUS.md`.

## 9) Contribution Standard

Every production-impacting change should include:

- technical summary
- verification commands + outcomes
- documentation updates when behavior/ops changed
- migration notes if schema/RLS changed
