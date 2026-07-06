# Host Calendar Status Fix + Booking Drawer on Host Views — Design

**Date:** 2026-07-06
**Status:** Approved

---

## Problems

1. **Calendar badge shows raw `flow_state`** — `HostCalendar.tsx` line 240 renders `{b.flow_state}` (technical internal value like `payment_pending`, `active`, `cancel_requested`) directly in the user-facing badge. The host dashboard and bookings list both show the coarse `status` field (`confirmed`, `pending`, `cancelled`) which is human-readable. Same booking appears as "confirmed" in one place and "payment_pending" in another.

2. **No detail view on host booking cards** — `HostBookings.tsx` shows booking cards with action buttons (Confirm / Decline / Rate guest) but no way to drill into full booking details (payment info, guest profile, property, notes).

3. **No detail view from host calendar day items** — Clicking a day in `HostCalendar` opens a `Dialog` listing bookings for that day, but each booking item is a read-only `<div>` — not clickable.

---

## Goals

1. Fix the calendar day dialog to show `status` (coarse, human-readable) in the badge — not `flow_state`.
2. Wire `BookingDetailDrawer` to booking items in the calendar day dialog.
3. Wire `BookingDetailDrawer` to booking cards in `HostBookings`.

---

## Non-Goals

- No changes to `BookingDetailDrawer` — it already works for both admin and host contexts.
- No changes to the calendar's cell coloring (still driven by `FLOW_STYLES` + `flow_state` — that's correct for visual density).
- No changes to action buttons (Confirm / Decline / Rate guest) — they keep working as-is.

---

## Design

### 1. `HostCalendar.tsx` — badge fix + drawer wiring

**Badge fix (line 240):**
```tsx
// Before
<Badge variant="outline" className="text-[10px]">{b.flow_state}</Badge>

// After
<Badge variant="outline" className="text-[10px] capitalize">{b.status}</Badge>
```
Keep the secondary text line (currently `Booking {id}… · status {b.status}`) — update it to show `flow_state` there instead, so the technical state is still visible for debugging but isn't the primary label.

**Drawer wiring:**
- Add `selectedBookingId` state: `const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)`
- Import `BookingDetailDrawer` from `@/components/BookingDetailDrawer`
- Each booking `<div>` inside the Dialog becomes a `<button>` that calls `setSelectedBookingId(b.id)` on click and closes the Dialog (`setOpenDay(null)`)
- Mount `<BookingDetailDrawer bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />` once at the bottom of the component return, outside the Dialog
- Touch target: `min-h-[44px]` on the booking button

**Booking button structure (replaces the current `<div key={b.id} ...>`):**
```tsx
<button
  key={b.id}
  onClick={() => { setOpenDay(null); setSelectedBookingId(b.id); }}
  className="w-full rounded-md border border-border/60 p-3 text-sm space-y-1 text-left hover:bg-secondary/40 transition-colors min-h-[44px]"
>
  <div className="flex items-center justify-between">
    <span className="font-medium">{b.listings?.title ?? "Listing"}</span>
    <Badge variant="outline" className="text-[10px] capitalize">{b.status}</Badge>
  </div>
  <p className="text-xs text-muted-foreground">
    {format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}
    {" · "} ₱{b.total_php.toLocaleString()}
  </p>
  <p className="text-[10px] text-muted-foreground">
    {b.id.slice(0, 8)}… · {b.flow_state}
  </p>
</button>
```

### 2. `HostBookings.tsx` — drawer wiring

**State + import:**
```tsx
const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
// import BookingDetailDrawer from "@/components/BookingDetailDrawer"
```

**Card click:** The outer card `<div key={b.id} className="rounded-xl border ...">` becomes a `<div>` with `onClick={() => setSelectedBookingId(b.id)}` and `cursor-pointer`. This is a `<div>` not a `<button>` because the card already contains buttons — nesting `<button>` inside `<button>` is invalid HTML.

**Action buttons:** Add `onClick={(e) => e.stopPropagation()}` to each action button (Confirm, Decline, Rate guest) so clicking them does not also open the drawer.

**Drawer mount:** `<BookingDetailDrawer bookingId={selectedBookingId} onClose={() => setSelectedBookingId(null)} />` once at the bottom of the return, outside the bookings map.

---

## Files Changed

| Action | Path | Change |
|--------|------|--------|
| Modify | `src/components/HostCalendar.tsx` | Badge: `flow_state` → `status`; booking divs → buttons; add drawer state + mount |
| Modify | `src/components/HostBookings.tsx` | Card click → open drawer; stopPropagation on action buttons; add drawer state + mount |
