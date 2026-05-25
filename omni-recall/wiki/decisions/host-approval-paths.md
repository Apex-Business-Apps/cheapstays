# Decision: Host Approval Paths

- date: 2026-05-23 (captured from PR #41–43 baseline)
- project: cheapstays
- status: active
- source: `CLAUDE.md` §5, §7

## Decision

Two separate host application paths exist and both must be handled in the Admin UI.

**Path A — KYC form** (`/host/apply`)
- Table: `host_applications`
- Edge function: `approve-host-application`
- Body: `{ application_id, target_user_id, reason_code, reviewer_notes? }`
- Admin UI: Applications tab → "Host Applications"

**Path B — Support chat**
- Table: `support_tickets` where `category = "host_verification"`
- Edge function: `approve-host-via-ticket`
- Body: `{ ticket_id }` only — `user_id` is extracted server-side
- Admin UI: Applications tab → "Verification requests"

**Deprecated:** `grant-host-role` — blocks self-grant, returns generic 400. Do not call.

## Rationale

Conflating both paths into one query caused missing applications in the Admin view. The two-path design is intentional and permanent.
