# Platform Status

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.0.0  
**Status Date:** 2026-05-21  
**Service State:** Operational with noted risks

## Environment Matrix

| Environment | Frontend | Backend | Auth | RBAC Admin | RLS Coverage | Notes |
|---|---|---|---|---|---|---|
| Production | Cloudflare Pages | Supabase | Enabled | Enabled | Enabled | Domain and cert propagation must be monitored after DNS edits |
| Local Dev | Vite Dev Server | Supabase (remote/local) | Enabled | Enabled (admin role required) | Enabled | Requires env configuration |

## Current Capability Snapshot

- ✅ RBAC admin dashboard for role management and support/audit visibility.
- ✅ Hero carousel expanded with existing stays + 8 city destinations.
- ✅ `concierge_requests` table added with RLS and audit-oriented schema.
- ✅ Support RLS hardened for update/insert ownership/admin checks.
- ✅ Live authorization smoke test executed for admin/non-admin flows.

## Known Risks / Tech Debt

1. **Bundle size risk:** Main JS bundle exceeds 500KB warning threshold in production build.
2. **Policy regression risk:** No automated CI database-level RLS test harness yet.
3. **Operational drift risk:** Manual role and token lifecycle processes need periodic review.

## Open Actions

| Priority | Action | Owner | Target Date | Status |
|---|---|---|---|---|
| P1 | Add automated RLS smoke tests to CI | Engineering | 2026-05-28 | Open |
| P1 | Add route-level/code-split optimization plan | Engineering | 2026-05-30 | Open |
| P2 | Implement token rotation SOP checkpoint reminders | Operations | 2026-06-05 | Open |

## Recent Change Log

- **2026-05-21:** Added RBAC admin dashboard enhancements and role mutation workflow.
- **2026-05-21:** Introduced `concierge_requests` with RLS policies and indexes.
- **2026-05-21:** Hardened `support_tickets` and `support_messages` policy checks.
- **2026-05-21:** Completed live smoke validation for role and RLS boundaries.
