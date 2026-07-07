# Admin Overview — Three-Tab Dashboard Design

**Date:** 2026-07-06
**Status:** Approved

---

## Problem

The current `/admin/overview` page is a flat layout: three stat cards and a booking calendar. There is no way for an admin to see what is happening today or to surface items that need immediate action without navigating to separate pages (Bookings, Tickets, Disbursements).

---

## Goals

1. Restructure the Overview page into three focused tabs: **Overview**, **Today's Activity**, and **Alerts**.
2. The Overview tab preserves and lightly extends the existing content.
3. Today's Activity gives the admin a daily check-in view (arrivals, departures, vouchers redeemed).
4. Alerts surfaces actionable items in one place (pending confirmations, urgent tickets, disbursement issues).

---

## Non-Goals

- No new database columns or migrations.
- No real-time subscriptions — all tabs load on mount and refresh on tab switch.
- No pagination — each tab caps results at a reasonable limit (50 items).
- No changes to `BookingDetailDrawer`, `BookingsPage`, `TicketsPage`, or any other admin page.

---

## Architecture

`OverviewPage.tsx` owns the `Tabs` shell and renders one of three sub-components depending on the active tab. Each sub-component owns its own Supabase queries and local state.

| File | Role |
|------|------|
| `src/pages/admin/OverviewPage.tsx` | Tabs shell + `BookingDetailDrawer` mount |
| `src/pages/admin/OverviewTab.tsx` | Stat cards + booking calendar (refactored from current page) |
| `src/pages/admin/TodayActivityTab.tsx` | Arrivals, departures, vouchers redeemed today |
| `src/pages/admin/AlertsTab.tsx` | Pending confirmations, urgent tickets, disbursement issues |

`BookingDetailDrawer` is mounted once in `OverviewPage` and controlled via a `selectedBookingId` state prop passed down to `OverviewTab` and `AlertsTab` (the two tabs that open it). `TodayActivityTab` also accepts the prop for arrivals/departures.

---

## Tab 1 — Overview

### Stat cards (4 cards, 2×2 grid on mobile, 4-column on desktop)

| Card | Label | Query |
|------|-------|-------|
| Active bookings | Count of `bookings` where `status = 'confirmed'` | existing |
| Open tickets | Count of `support_tickets` where `status IN ('open', 'escalated')` | existing |
| Pending applications | Count of `host_applications` where `status IN ('pending', 'manual_review')` | existing |
| Revenue this month | Sum of `total_php` on `bookings` where `status = 'confirmed'` AND `created_at` within current calendar month | new |

Revenue displayed as `₱{n.toLocaleString()}`.

### Booking calendar

Unchanged from the current implementation. Clicking a booking day cell opens `BookingDetailDrawer` via `onSelectBooking`.

---

## Tab 2 — Today's Activity

Three sections rendered vertically. Each section has a heading and an empty state if no records are found.

### Arrivals
- **Query:** `bookings` where `check_in = today` AND `status = 'confirmed'`
- **Select:** `.select("id, guest_id, check_in, check_out, nights, guests, total_php, status, listings(title)")` — `check_in` is a date string (`yyyy-MM-dd`); filter with `.eq("check_in", format(new Date(), "yyyy-MM-dd"))`
- **Display:** Listing title (from join), guest ID short (`guest_id.slice(0, 8)` — full name visible in drawer), number of guests, total amount
- **Click:** Opens `BookingDetailDrawer`
- **Empty state:** "No check-ins today"

### Departures
- **Query:** `bookings` where `check_out = today` AND `status = 'confirmed'` — filter with `.eq("check_out", format(new Date(), "yyyy-MM-dd"))`
- **Select:** Same as Arrivals
- **Display:** Same columns
- **Click:** Opens `BookingDetailDrawer`
- **Empty state:** "No check-outs today"

### Vouchers Redeemed Today
- **Query:** `vouchers` where `redeemed_at::date = today` (filter: `redeemed_at.gte` start of today, `redeemed_at.lt` start of tomorrow)
- **Select:** `id, code, listing_id, amount_paid, redeemed_at, listings(title)`
- **Display:** Voucher code (monospace), listing title, amount paid (₱), time redeemed
- **Click:** No action (read-only row)
- **Empty state:** "No vouchers redeemed today"

**Data fetching:** One `Promise.all` fetches all three in parallel on mount.

---

## Tab 3 — Alerts

Three alert groups. Each group has a section header with a count badge. If the count is 0, the badge is hidden and a subtle "All clear" line replaces the list. If all three groups are empty, a full-page empty state is shown: "No alerts — everything looks good."

### Pending Confirmations
- **Query:** `bookings` where `flow_state = 'requested'` (request-booking awaiting host confirmation)
- **Select:** `id, listing_id, guest_id, check_in, check_out, total_php, created_at, listings(title)`
- **Display:** Listing title, check-in → check-out dates, total, time since created ("2 hours ago" via `formatDistanceToNow`)
- **Badge color:** Amber (warning)
- **Action:** "View booking" button → opens `BookingDetailDrawer`

### Urgent Support Issues
- **Query:** `support_tickets` where `(escalated = true OR priority = 'urgent') AND status != 'resolved'`
- **Select:** `id, ticket_num, subject, status, priority, escalated, created_at`
- **Display:** `#ticket_num` + subject, priority badge (Urgent / Escalated), time since created
- **Badge color:** Red (destructive)
- **Action:** "View ticket" link → navigates to `/admin/tickets` (no drawer, tickets have their own page)

### Disbursement Issues
- **Query:** `disbursement_requests` where `status IN ('pending', 'failed')`
- **Select:** `id, amount, status, payout_method, retry_count, requested_at, failure_reason`
- **Display:** Amount (₱), payout method (capitalized), status badge (Pending = amber, Failed = red), retry count if > 0, time since requested
- **Badge color:** Amber for pending, red for failed
- **Action:** "View disbursements" link → navigates to `/admin/disbursements`

---

## UI Patterns

- **Tabs component:** shadcn/ui `Tabs` / `TabsList` / `TabsTrigger` / `TabsContent` — same pattern used in `Notifications.tsx`
- **Alert rows:** `rounded-xl border border-border bg-card p-4` cards — same card style used in `HostBookings.tsx`
- **Badges:** shadcn/ui `Badge` with `variant="outline"` and color overrides via className
- **Empty states:** Centered text in muted foreground, icon optional
- **Loading:** Each tab shows a simple `"Loading…"` text while its query runs (no skeleton needed — tabs load fast)
- **Capitalize:** All status and method values use the `capitalize` CSS class
- **Touch targets:** All interactive elements `min-h-[44px]`
- **Tailwind only:** No inline styles

---

## Data Flow

```
OverviewPage
├── selectedBookingId state
├── Tabs shell (Overview / Today's Activity / Alerts)
│   ├── OverviewTab     → receives onSelectBooking
│   ├── TodayActivityTab → receives onSelectBooking
│   └── AlertsTab       → receives onSelectBooking
└── BookingDetailDrawer (bookingId=selectedBookingId)
```

Each tab component:
- Fetches its own data on mount via `useEffect`
- Owns its own `loading` and `error` state
- Does not share state with other tabs

---

## Files Changed

| Action | Path | Change |
|--------|------|--------|
| Modify | `src/pages/admin/OverviewPage.tsx` | Replace with Tabs shell; extract `BookingCalendar` to `OverviewTab.tsx` |
| Create | `src/pages/admin/OverviewTab.tsx` | Stat cards (4) + booking calendar |
| Create | `src/pages/admin/TodayActivityTab.tsx` | Arrivals, departures, vouchers |
| Create | `src/pages/admin/AlertsTab.tsx` | Pending confirmations, urgent tickets, disbursement issues |
