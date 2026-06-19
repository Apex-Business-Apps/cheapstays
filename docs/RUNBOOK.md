# Operations Runbook

**Organization:** JGP Corporation  
**Location:** Pasig City, Metro Manila, Philippines  
**Document Version:** 1.2.0  
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

## 5) Supabase Migrations

Migrations live in `supabase/migrations/`. Apply them in order by filename (timestamp prefix).

### Option A: Migration helper script

```bash
python3 supabase/scripts/apply_migration.py <migration_file.sql>
```

The script reads the `SUPABASE_DB_URL` environment variable and applies the SQL file via a direct database connection.

### Option B: Supabase Management API

Send the migration SQL as a POST request to the Supabase Management API:

```
POST https://api.supabase.com/v1/projects/{project_ref}/database/migrations
Authorization: Bearer <SUPABASE_ACCESS_TOKEN>
Content-Type: application/json
```

Pass the SQL content in the request body.

### Option C: Supabase CLI (local dev)

```bash
supabase db push
```

This applies all pending local migrations to the linked remote project. Requires `supabase link` with the project ref `muqdmvkapsxrsgdkfoxn` and a valid access token.

### After any migration

- Run smoke tests to verify RLS boundaries for affected tables.
- Update `docs/STATUS.md` with a change log entry.

## 6) Edge Function Deployment

Deploy individual edge functions using the Supabase CLI:

```bash
SUPABASE_ACCESS_TOKEN=<token> npx supabase functions deploy <function-name> --project-ref muqdmvkapsxrsgdkfoxn
```

Replace `<function-name>` with one of: `book-listing`, `booking-checkout`, `ai-search`, or any other function under `supabase/functions/`.

The access token must have edge function deploy permissions scoped to the project.

After deploying, verify the function is reachable and returns expected responses. For `book-listing` and `booking-checkout`, confirm rate limiting is active by checking response headers.

## 7) Payment Gateway (PayMongo)

### Configuring the secret key

1. Log in to the Supabase dashboard for project `muqdmvkapsxrsgdkfoxn`.
2. Navigate to Project Settings > Edge Functions > Secrets.
3. Add a new secret named `PAYMONGO_SECRET_KEY` with the value from the PayMongo dashboard.
4. Redeploy the `booking-checkout` function so it picks up the new secret.

### Production Gating & Fail-Closed Behavior

To guarantee money-path safety, CheapStays uses an environment-gated fail-closed payment architecture:

- **APP_ENV=production**: If `PAYMONGO_SECRET_KEY` is missing or payments are disabled, all payment checkout creation requests fail hard (returning a `500 Internal Server Error` response) and block booking confirmation. Null checkout URL responses are prevented.
- **APP_ENV=development/staging**: If `PAYMONGO_SECRET_KEY` is absent, the function operates in local/demo mode (returning a `checkout_url: null` response) to allow local/staging guest demo flows to proceed.
- **PAYMENTS_ENABLED=false**: All checkout attempts fail with a `403 Forbidden` response.

Manual card-hold holds via client keys are completely disabled in favor of secure, 3DS-compliant hosted checkouts.

### Go-live checklist

- [ ] Obtain live secret key from PayMongo dashboard (separate from test key).
- [ ] Add `PAYMONGO_SECRET_KEY` to Supabase Edge Function secrets in the production project.
- [ ] Set `APP_ENV=production` and `PAYMENTS_ENABLED=true` in secrets.
- [ ] Redeploy `booking-checkout` function.
- [ ] Perform an end-to-end test payment using a PayMongo test card or GCash sandbox.
- [ ] Confirm booking status transitions from `pending` to `confirmed` only after payment success webhook or intent confirmation.

## 8) Troubleshooting Matrix

| Symptom | Likely Cause | Diagnostic Step | Resolution |
|---|---|---|---|
| 403 on role mutation for admin user | Missing admin role assignment | Query `user_roles` for actor | Grant `admin` role and retest |
| Non-admin can mutate role data | RLS regression | Inspect `pg_policies` | Reapply migration/hotfix policy |
| Support messages insert fails | ticket ownership mismatch / sender policy | Verify `ticket_id`, `author_user_id`, sender | Align payload with RLS rules |
| Deploy succeeds but domain not live | DNS/cert propagation | Check Pages domain status | Wait propagation; confirm CNAME/proxy |
| `booking-checkout` fails with 500 | PAYMONGO_SECRET_KEY not set in production | Check Edge Function secrets in Supabase dashboard | Add key and redeploy function |
| `book-listing` returns 429 | Rate limit exceeded (10 req/min per IP) | Confirm caller IP and request frequency | Reduce request rate or review client retry logic |
| Booking stuck in pending after payment | PayMongo webhook not delivered or key misconfigured | Check PayMongo dashboard for session status | Verify secret key and webhook endpoint configuration |

## 9) Rollback Playbook

- For frontend regressions: redeploy prior known-good build.
- For migration regressions:
  1. apply corrective migration (preferred)
  2. if needed, restore from point-in-time backup per Supabase recovery process
- Document rollback cause and preventive action in `docs/STATUS.md`.

## 10) Contact & Ownership

- Product/Engineering Owner: JGP Corporation
- Operational Base: Pasig City, Metro Manila, Philippines
- Escalation Path: Engineering lead → Platform owner → Executive stakeholder
