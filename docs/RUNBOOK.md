# Operations Runbook

**Organization:** JGP Corporation  
**Location:** Pasig City, Metro Manila, Philippines  
**Document Version:** 1.3.0  
**Last Updated:** 2026-08-18

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

## 10) Host Payout Flow (booking → withdrawable money)

End-to-end trace of how a paid booking becomes money a host can withdraw. Every
step in the pipeline is idempotent — safe to re-run any function without
double-crediting or double-releasing.

### 10.1 Timeline for a normal booking

Example: guest books today for a stay 25–28 of the month.

| When | Event | Effect on host wallet |
|------|-------|-----------------------|
| Booking day | Guest completes PayMongo checkout | Booking flips to `payment_status='paid'`, `status='confirmed'`. `refundable_until = check_in - 2 days`, `payout_release_on = check_in + 1 day` are written on the booking. |
| Booking day, seconds later | `paymongo-webhook` fires `credit-host-wallet` | 90 % of the booking total lands in `host_wallets.pending_balance`. A `credit_pending` row is written to `wallet_transactions`. Platform keeps 10 %. |
| Check-in − 2 days | Refund window closes | Guest can no longer self-refund. Money is now the host's to keep, but still not withdrawable. |
| Check-in day | Guest checks in | No change to wallet. |
| Check-in + 1 day | `payout_release_on` elapses | Money becomes **eligible** to move from pending → available. Actual move waits for the next daily sweeper tick. |
| Next daily 02:00 Asia/Manila | `wallet-release-sweep` cron runs | Sweeper moves 90 % of total from `pending_balance` → `available_balance` and writes a `release_to_available` ledger row. |
| After that | Host requests payout via `/host/wallet` | Preconditions: `available_balance ≥ ₱500`, `host_payout_accounts.is_verified = true`, no in-flight request, not requested in the last 7 days. |
| Admin action | `/admin/disbursements` → attach proof | Admin sends off-platform (GCash / bank transfer), uploads screenshot, request flips to `awaiting_confirmation`. |
| Host action | Host confirms receipt in `/host/wallet` | Request flips to `released`. Flow complete. |

**Rule of thumb:** money is available on the *morning after* `check_in + 1 day`.
Worst-case lag from check-in to withdrawable = **1 day + up to 24 h** (dependent on
when the 02:00 Manila cron ticks vs. exactly when `payout_release_on` passes).

### 10.2 Scheduled jobs

Two pg_cron jobs (registered by migration
`20260818000000_wallet_release_scheduler.sql`) drive the wallet lifecycle:

| jobname | Schedule (UTC) | Manila local | Target function | Purpose |
|---------|----------------|--------------|-----------------|---------|
| `cheapstays-wallet-credit-reconcile` | `30 17 * * *` | 01:30 | `wallet-credit-reconcile` | Finds paid+confirmed bookings with **no `credit_pending` ledger row** and credits them. Safety net for the fire-and-forget `credit-host-wallet` call from `paymongo-webhook`. |
| `cheapstays-wallet-release-sweep` | `0 18 * * *` | 02:00 | `wallet-release-sweep` | Finds paid bookings whose `payout_release_on ≤ now()` and no `release_to_available` row exists, and moves pending → available. |

Reconcile runs 30 min *before* release so a credit repaired at 01:30 can be
released in the same nightly run if the payout window has elapsed.

Verify jobs are registered:

```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE 'cheapstays-wallet-%';
```

Recent run history:

```sql
SELECT jobname, status, start_time, end_time, return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE j.jobname LIKE 'cheapstays-wallet-%'
ORDER BY start_time DESC LIMIT 20;
```

### 10.3 Manual triggers (support / one-off backfill)

Admin (service-role key) can force-run either sweeper without waiting for cron:

```bash
# Repair any dropped credits (safe to run any time)
curl -X POST "$SUPABASE_URL/functions/v1/wallet-credit-reconcile" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{}'

# Release matured pending balances now
curl -X POST "$SUPABASE_URL/functions/v1/wallet-release-sweep" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" -d '{}'
```

Both return `{ swept, ..., errors: [] }` — inspect `errors` if non-empty.

For a single booking (e.g. a support ticket asks for immediate release), the
per-booking endpoints still work:

```bash
curl -X POST "$SUPABASE_URL/functions/v1/credit-host-wallet" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"<UUID>"}'

curl -X POST "$SUPABASE_URL/functions/v1/release-pending-balance" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"booking_id":"<UUID>"}'
```

### 10.4 Diagnosing "host says money is stuck"

Run these SQL blocks in the Supabase SQL editor, substituting the host's email.

**Where is their money right now?**

```sql
SELECT hw.pending_balance, hw.available_balance, hw.is_frozen,
       hpa.payout_method, hpa.is_verified AS payout_verified
FROM auth.users u
LEFT JOIN host_wallets hw ON hw.host_id = u.id
LEFT JOIN host_payout_accounts hpa ON hpa.host_id = u.id
WHERE u.email = '<host_email>';
```

**Which of their bookings have paid but never got credited or released?**

```sql
SELECT b.id AS booking_id, b.check_in, b.check_out, b.payment_status,
       b.total_php, b.paid_at, b.payout_release_on,
       (SELECT id FROM wallet_transactions wt
          WHERE wt.booking_id = b.id AND wt.type='credit_pending') AS credit_pending_tx_id,
       (SELECT id FROM wallet_transactions wt
          WHERE wt.booking_id = b.id AND wt.type='release_to_available') AS release_tx_id
FROM bookings b
JOIN auth.users u ON u.id = b.host_id
WHERE u.email = '<host_email>'
ORDER BY b.created_at DESC;
```

Interpretation:

| Result | Meaning | Fix |
|--------|---------|-----|
| `credit_pending_tx_id` NULL for a paid booking | `credit-host-wallet` never fired / errored silently | Run `wallet-credit-reconcile` (or force per booking) |
| `credit_pending_tx_id` present, `release_tx_id` NULL, `payout_release_on ≤ now()` | Release cron hasn't run yet since the window elapsed | Wait for next 02:00 Manila tick, or run `wallet-release-sweep` |
| `release_tx_id` present but `available_balance = 0` | Release happened but a later disbursement or reversal consumed it | Check `wallet_transactions` full ledger |
| `hpa.is_verified = false` | Even after release, host can't request payout | Admin verifies the payout account in `/admin/hosts` |
| `hw.is_frozen = true` | All wallet operations blocked | Admin unfreezes in `/admin/hosts` |

### 10.5 Why the sweepers exist

Before migration `20260818000000_wallet_release_scheduler.sql`, no code path
called `release-pending-balance` — the old monthly cron (`cheapstays-monthly-host-payouts`)
was unscheduled on 2026-07-22 in favour of a host-controlled disbursement
flow, but the pending → available step was never re-wired. Money credited to
`pending_balance` had no path out, so `request-disbursement` always refused
(`available < ₱500`). The reconcile sweeper additionally protects against the
fire-and-forget `credit-host-wallet` call from `paymongo-webhook`, which
returns 200 to PayMongo even when the credit HTTP call fails.

## 11) Contact & Ownership

- Product/Engineering Owner: JGP Corporation
- Operational Base: Pasig City, Metro Manila, Philippines
- Escalation Path: Engineering lead → Platform owner → Executive stakeholder
