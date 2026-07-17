# Host Calendar Status Fix + Booking Drawer on Host Views — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the host calendar dialog to show human-readable booking `status` instead of raw `flow_state`, and wire `BookingDetailDrawer` to booking items in both `HostCalendar` and `HostBookings`.

**Architecture:** Two independent file-scoped tasks. Task 1 modifies `HostCalendar.tsx`: swaps the badge field and converts booking `<div>` items in the Dialog to clickable `<button>` elements that open `BookingDetailDrawer`. Task 2 modifies `HostBookings.tsx`: makes the booking card `<div>` clickable and adds `stopPropagation` to action buttons. Both mount `BookingDetailDrawer` once per component.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui `Badge`, `Dialog`, `BookingDetailDrawer` (already exists at `src/components/BookingDetailDrawer.tsx`)

## Global Constraints

- No new npm packages — `BookingDetailDrawer` already exists at `src/components/BookingDetailDrawer.tsx`
- `BookingDetailDrawer` props: `{ bookingId: string | null; onClose: () => void }` — do not change this component
- Tailwind only, no inline styles
- `min-h-[44px]` on every interactive element
- Action buttons in `HostBookings` (Confirm, Decline, Rate guest, Cancel rating) must keep working — add `e.stopPropagation()` to each
- `<div onClick>` used for booking cards (not `<button>`) because the card contains buttons — nesting `<button>` inside `<button>` is invalid HTML
- TypeScript must be clean (`npx tsc --noEmit` exits 0) after each task

---

## File Map

| Action | Path | Change |
|--------|------|--------|
| Modify | `src/components/HostCalendar.tsx` | Badge: `flow_state` → `status`; booking divs in Dialog → buttons; drawer state + mount |
| Modify | `src/components/HostBookings.tsx` | Card div clickable; stopPropagation on buttons; drawer state + mount |

---

### Task 1: Fix `HostCalendar.tsx` — badge field + drawer wiring

**Files:**
- Modify: `src/components/HostCalendar.tsx`

**Interfaces:**
- Consumes: `BookingDetailDrawer` from `@/components/BookingDetailDrawer` — props `{ bookingId: string | null; onClose: () => void }`
- The `BookingRow` type already has both `status` and `flow_state` fields — no type changes needed

- [ ] **Step 1: Add `BookingDetailDrawer` import and `selectedBookingId` state**

In `src/components/HostCalendar.tsx`:

Add to the imports block (after line 12, `import { cn } from "@/lib/utils";`):
```tsx
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
```

Add `selectedBookingId` state inside `HostCalendar` (after line 65, `const [openDay, setOpenDay] = useState<DayMeta | null>(null);`):
```tsx
const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
```

- [ ] **Step 2: Convert booking `<div>` items in Dialog to clickable `<button>` elements**

In the Dialog's `openDay.bookings.map(...)` block (lines 236–250), replace the entire `<div key={b.id} ...>` with a `<button>`:

```tsx
{openDay.bookings.map((b) => (
  <button
    key={b.id}
    type="button"
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
))}
```

Key changes from old code:
- `<div>` → `<button type="button">` with `onClick` that closes Dialog and sets `selectedBookingId`
- Badge: `{b.flow_state}` → `{b.status}` with `capitalize` class
- Secondary text: now shows `{b.flow_state}` (technical detail) instead of `status {b.status}`

- [ ] **Step 3: Mount `BookingDetailDrawer` at the bottom of the component**

Add before the closing `</Card>` tag (after the `</Dialog>` closing tag, line 264):

```tsx
<BookingDetailDrawer
  bookingId={selectedBookingId}
  onClose={() => setSelectedBookingId(null)}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/HostCalendar.tsx
git commit -m "fix(host): show booking status (not flow_state) in calendar dialog + open detail drawer on click"
```

---

### Task 2: Wire `BookingDetailDrawer` into `HostBookings.tsx`

**Files:**
- Modify: `src/components/HostBookings.tsx`

**Interfaces:**
- Consumes: `BookingDetailDrawer` from `@/components/BookingDetailDrawer` — props `{ bookingId: string | null; onClose: () => void }`

- [ ] **Step 1: Add `BookingDetailDrawer` import and `selectedBookingId` state**

In `src/components/HostBookings.tsx`:

Add to imports (after line 10, `import { cn } from "@/lib/utils";`):
```tsx
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
```

Add state inside `HostBookings` (after line 57, `const [updating, setUpdating] = useState<string | null>(null);`):
```tsx
const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
```

- [ ] **Step 2: Make booking card `<div>` clickable**

The outer card `<div>` (line 186) currently is:
```tsx
<div key={b.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
```

Change to (add `onClick`, `cursor-pointer`, `hover` style):
```tsx
<div
  key={b.id}
  className="rounded-xl border border-border/60 bg-card p-4 space-y-3 cursor-pointer hover:bg-secondary/20 transition-colors"
  onClick={() => setSelectedBookingId(b.id)}
>
```

- [ ] **Step 3: Add `stopPropagation` to all action buttons**

Each button inside the card must stop the click from bubbling to the card's `onClick`. Update all five interactive elements in the actions area:

**Confirm button** (currently line 217):
```tsx
<Button
  size="sm"
  className="gap-1.5"
  disabled={updating === b.id}
  onClick={(e) => { e.stopPropagation(); updateStatus(b.id, "confirmed"); }}
>
  {updating === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
  Confirm
</Button>
```

**Decline button** (currently line 221):
```tsx
<Button
  size="sm"
  variant="outline"
  className="gap-1.5 text-destructive hover:text-destructive"
  disabled={updating === b.id}
  onClick={(e) => { e.stopPropagation(); updateStatus(b.id, "cancelled"); }}
>
  <XCircle className="h-3 w-3" /> Decline
</Button>
```

**Rate guest button** (currently line 227):
```tsx
<Button
  size="sm"
  variant="outline"
  className="gap-1.5"
  onClick={(e) => { e.stopPropagation(); setRateState({ bookingId: b.id, guestId: b.guest_id, listingId: b.listing_id }); }}
>
  <Star className="h-3 w-3" /> Rate guest
</Button>
```

Also add `stopPropagation` to the two buttons inside the rating panel (the "Post review" and "Cancel" buttons in the `rateState` form, lines 177–181):
```tsx
<Button size="sm" disabled={rating === 0 || submitting} onClick={(e) => { e.stopPropagation(); submitGuestReview(); }}>
  {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post review"}
</Button>
<Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setRateState(null); setRating(0); setBody(""); }}>Cancel</Button>
```

- [ ] **Step 4: Mount `BookingDetailDrawer` at the end of the return**

Add before the closing `</div>` of the outer `return` (after the `bookings.map(...)` block):

```tsx
<BookingDetailDrawer
  bookingId={selectedBookingId}
  onClose={() => setSelectedBookingId(null)}
/>
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Manual smoke test**

1. `npm run dev` — sign in as a host
2. Go to `/host/calendar` — click a day cell that has bookings
3. Verify: Dialog opens, each booking shows `status` badge (e.g. "confirmed") not "payment_pending"
4. Verify: secondary line shows `flow_state` (e.g. "active")
5. Click a booking item → Dialog closes, `BookingDetailDrawer` slides in from the right
6. Verify drawer shows full details (hero strip, timeline, guest, host, payment, property)
7. Close drawer — go to `/host/bookings`
8. Click a booking card (not a button) → `BookingDetailDrawer` slides in
9. Click Confirm / Decline / Rate guest → button action fires, drawer does NOT open

- [ ] **Step 7: Commit**

```bash
git add src/components/HostBookings.tsx
git commit -m "feat(host): open BookingDetailDrawer on booking card click in host bookings"
```
