# Operations Runbook

**Organization:** APEX Business Systems Ltd.  
**Location:** Edmonton, AB  
**Document Version:** 1.1.0  
**Last Updated:** 2026-05-21

## 1) Incident Severity Model

- **SEV-1:** Full production outage or auth/data breach risk.
- **SEV-2:** Major feature unavailable (admin/support flow blocked).
- **SEV-3:** Degraded performance or non-critical defects.

## 2) Standard Release Procedure

1. Validate branch status and run quality gates:
   ```bash
   npm run build
   npm run test
   ```
2. Apply pending migrations to Supabase.
3. Validate RLS-sensitive flows (admin vs non-admin).
4. Deploy frontend to Cloudflare Pages using the production branch target (`main`) so the deployment is promoted automatically.
5. Verify public URLs and admin/support paths.
6. Update `docs/STATUS.md` with change summary/date.



### Production promotion command (required)

```bash
npm run release:production
```

- This wraps build + `wrangler pages deploy ... --branch main`.
- Deploying to any non-`main` branch creates a **Preview** deployment and will not promote to production.

## 3) RLS Change Procedure

When a migration modifies RLS/policies:

1. Execute migration in target environment.
2. Run smoke tests for:
   - role grant/revoke
   - support ticket/message ownership
   - concierge read/write boundaries
3. Capture evidence (HTTP status/API responses).
4. Roll back or patch immediately on policy regressions.

## 4) Cloudflare Token Permissions (Least Privilege)

For Pages + DNS workflow:

- Account: `Cloudflare Pages: Edit`
- Zone: `DNS: Edit`
- Zone: `Zone: Read`

Scope all permissions to:

- single account
- production zone only (`cheapstays.me`)

## 5) Troubleshooting Matrix

| Symptom | Likely Cause | Diagnostic Step | Resolution |
|---|---|---|---|
| 403 on role mutation for admin user | Missing admin role assignment | Query `user_roles` for actor | Grant `admin` role and retest |
| Non-admin can mutate role data | RLS regression | Inspect `pg_policies` | Reapply migration/hotfix policy |
| Support messages insert fails | ticket ownership mismatch / sender policy | Verify `ticket_id`, `author_user_id`, sender | Align payload with RLS rules |
| Deploy succeeds but domain not live | DNS/cert propagation | Check Pages domain status | Wait propagation; confirm CNAME/proxy |

## 6) Rollback Playbook

- For frontend regressions: redeploy prior known-good build.
- For migration regressions:
  1. apply corrective migration (preferred)
  2. if needed, restore from point-in-time backup per Supabase recovery process
- Document rollback cause and preventive action in `docs/STATUS.md`.

## 7) Contact & Ownership

- Product/Engineering Owner: APEX Business Systems Ltd.
- Operational Base: Edmonton, AB
- Escalation Path: Engineering lead → Platform owner → Executive stakeholder
