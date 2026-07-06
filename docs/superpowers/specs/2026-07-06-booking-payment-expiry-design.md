# Booking Payment Expiry + Host Calendar Accuracy — Design

**Date:** 2026-07-06
**Status:** Approved

---

## Problem

Short-term bookings (`booking_flow = 'instant_book'`) are created in `flow_state = 'payment_pending'` and immediately appear on the host's calendar, blocking dates — even though the guest has not paid. This lets an unpaying guest occupy a date indefinitely. There is also no automatic cleanup for bookings that remain unpaid past the check-in date.

---

## Goals

1. Auto-expire short-term bookings that are not paid within a deadline window.
2. Auto-expire any unpaid booking whose check-in date has already passed.
3. Remove unpaid bookings from the host calendar view so only confirmed (paid) bookings block dates.

---

## Non-Goals

- Long-term request bookings (`booking_flow = 'request_booking'`) already have their own expiry flow (`approval_deadline_at` + `expire-pending-long-term-requests`). This feature does not touch them.
- No new database columns. All logic derived from existing fields.
- No guest-facing countdown UI. Expiry is silent — guest is notified after the fact.

---

## Design

### 1. Payment deadline rules (no new column)

Deadline is computed at query time from `bookings.created_at` and `listings.instant_book`:

| Listing `instant_book` | Window |
|---|---|
| `true` | 5 minutes from `created_at` |
| `false` | 30 minutes from `created_at` |

The scheduler JOIN to `listings` provides the `instant_book` flag.

### 2. New edge function: `expire-unpaid-bookings`

**File:** `supabase/functions/expire-unpaid-bookings/index.ts`

**Auth:** Service role only — same pattern as `expire-pending-long-term-requests`.

**Query:** Finds all bookings where:
- `flow_state = 'payment_pending'`
- `booking_flow = 'instant_book'` (excludes long-term requests)
- AND one of:
  - `listings.instant_book = true` AND `bookings.created_at < now() - interval '5 minutes'`
  - `listings.instant_book = false` AND `bookings.created_at < now() - interval '30 minutes'`
  - `bookings.check_in < CURRENT_DATE` (past-due regardless of window)

**Per booking:**
1. `UPDATE bookings SET flow_state = 'expired', status = 'cancelled' WHERE id = ? AND flow_state = 'payment_pending'` (idempotent guard on `flow_state`)
2. `recordTransition(...)` with `reason = 'payment_deadline_passed'` or `'check_in_date_passed'`
3. `dispatchNotification(...)` to guest: `payment_expired` type, "Your booking was cancelled because payment was not completed in time."
4. Collect `expired[]` and `failed[]` lists for the response

**Response:** `{ expired: string[], failed: { id, error }[], scanned: number }`

**Follows exactly** the pattern of `expire-pending-long-term-requests/index.ts`.

### 3. New cron job

**File:** New SQL migration `supabase/migrations/20260706000000_expire_unpaid_bookings_job.sql`

Registers `expire-unpaid-bookings` via `pg_cron` + `pg_net` on schedule `*/2 * * * *` (every 2 minutes).

Idempotent: deletes the job by name before re-creating it. Wrapped in `DO $$ BEGIN ... EXCEPTION WHEN undefined_table/function THEN NULL; END $$` guards — same pattern as `20260524050000_booking_scheduler_jobs.sql`.

### 4. Host calendar filter

**File:** `src/components/HostCalendar.tsx`

The existing Supabase query (line ~81) fetches all bookings for the host with no `flow_state` filter. Add `.neq("flow_state", "payment_pending")` to exclude unpaid bookings.

Result: only bookings where payment has been confirmed (flow_state moves past `payment_pending` to `active`, `approved`, etc.) appear on the host calendar and block dates.

---

## State Transitions

```
payment_pending → expired  (flow_state)
pending         → cancelled (coarse status)
```

Recorded in `booking_transitions` with `actorRole = 'scheduler'` and reason `'payment_deadline_passed'` or `'check_in_date_passed'`.

---

## Notification

Guest receives a notification of type `payment_expired` after expiry. This is best-effort (`.catch(() => {})`) — expiry proceeds even if notification fails.

---

## Files Changed

| Action | Path |
|--------|------|
| Create | `supabase/functions/expire-unpaid-bookings/index.ts` |
| Create | `supabase/migrations/20260706000000_expire_unpaid_bookings_job.sql` |
| Modify | `src/components/HostCalendar.tsx` |
