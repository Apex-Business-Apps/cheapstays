# Booking Drawer Redesign + Overview Calendar Wiring — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain text-grid booking drawer with a visually rich design, and wire the Overview page calendar so clicking any day with bookings opens the same drawer via popover-list for multi-booking days.

**Architecture:** Task 1 rewrites `BookingDetailDrawer.tsx` in-place — same props interface `{ bookingId: string | null; onClose: () => void }`, same fetch logic, entirely new render layer using cards, avatar initials, a stay timeline, and icon rows. Task 2 rewrites `OverviewPage.tsx`: `BookingCalendar` gains an `onSelectBooking` prop, day cells branch into plain div (0 bookings), button (1 booking), or Popover (2+), and the page mounts `BookingDetailDrawer` once with `selectedId` state.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui (`Sheet`, `Popover`, `Avatar`, `Badge`, `Skeleton`), lucide-react, date-fns

## Global Constraints

- No new npm packages — `Avatar`, `Popover` are already in `src/components/ui/`
- Tailwind only — no inline styles
- `min-h-[44px]` on every interactive element (buttons, links)
- Dark-mode safe — all color classes must pair a light and `dark:` variant
- Props interface of `BookingDetailDrawer` must not change: `{ bookingId: string | null; onClose: () => void }`
- Profiles table: query with `.eq("user_id", ...)` not `.eq("id", ...)`
- Read-only throughout — no mutations
- TypeScript must be clean (`npx tsc --noEmit` exits 0) after each task

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/components/BookingDetailDrawer.tsx` | Visual redesign — new render, same fetch + props |
| Modify | `src/pages/admin/OverviewPage.tsx` | Add `onSelectBooking` prop to `BookingCalendar`, Popover for multi-booking days, mount drawer |

---

### Task 1: Redesign `BookingDetailDrawer`

**Files:**
- Modify: `src/components/BookingDetailDrawer.tsx`

**Interfaces:**
- Props unchanged: `{ bookingId: string | null; onClose: () => void }`
- Fetch logic unchanged — keep the same `useEffect` / `Promise.all` / stale-guard pattern
- Produces: visually redesigned drawer consumed by `BookingsPage` (already wired) and `OverviewPage` (Task 2)

- [ ] **Step 1: Replace the file with the redesigned component**

Overwrite `src/components/BookingDetailDrawer.tsx` with the full content below. Read the existing file first so you understand what the fetch logic looks like, then write this:

```tsx
import { Fragment, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { AlertCircle, ArrowRight, Building2, Calendar, CreditCard, ExternalLink, Receipt } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import type { BookingDetail } from "@/pages/admin/types";
import { STATUS_COLORS } from "@/pages/admin/types";

const STATUS_STYLES: Record<string, { border: string; bg: string }> = {
  confirmed: { border: "border-l-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  pending:   { border: "border-l-amber-400",   bg: "bg-amber-50 dark:bg-amber-950/30" },
  cancelled: { border: "border-l-red-400",     bg: "bg-red-50 dark:bg-red-950/30" },
  completed: { border: "border-l-blue-400",    bg: "bg-blue-50 dark:bg-blue-950/30" },
  no_show:   { border: "border-l-gray-400",    bg: "bg-gray-50 dark:bg-gray-900/30" },
};

interface Props {
  bookingId: string | null;
  onClose: () => void;
}

export function BookingDetailDrawer({ bookingId, onClose }: Props) {
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) { setDetail(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDetail(null);

    (async () => {
      const { data: bk, error: bkErr } = await supabase
        .from("bookings")
        .select(`
          id, listing_id, guest_id, host_id,
          check_in, check_out, nights, guests, status, total_php,
          payment_status, payment_method, payment_ref,
          refundable_until, payout_release_on,
          guest_message, cancellation_reason, cancelled_at,
          confirmed_at, created_at
        `)
        .eq("id", bookingId)
        .single();

      if (bkErr || !bk) {
        if (!cancelled) { setError("Could not load booking."); setLoading(false); }
        return;
      }

      const [
        { data: guestProfile },
        { data: hostProfile },
        { data: listing },
      ] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("user_id", bk.guest_id).maybeSingle(),
        supabase.from("profiles").select("display_name").eq("user_id", bk.host_id).maybeSingle(),
        supabase.from("listings").select("title, city, province, address, type, nightly_php").eq("id", bk.listing_id).maybeSingle(),
      ]);

      if (cancelled) return;

      setDetail({
        ...bk,
        payment_status: bk.payment_status ?? null,
        payment_method: bk.payment_method ?? null,
        payment_ref: bk.payment_ref ?? null,
        refundable_until: bk.refundable_until ?? null,
        payout_release_on: bk.payout_release_on ?? null,
        guest_message: bk.guest_message ?? null,
        cancellation_reason: bk.cancellation_reason ?? null,
        cancelled_at: bk.cancelled_at ?? null,
        confirmed_at: bk.confirmed_at ?? null,
        guestName: guestProfile?.display_name ?? bk.guest_id.slice(0, 8),
        hostName: hostProfile?.display_name ?? bk.host_id.slice(0, 8),
        listingTitle: listing?.title ?? "Unknown listing",
        listingCity: listing?.city ?? "",
        listingProvince: listing?.province ?? "",
        listingAddress: listing?.address ?? null,
        listingType: listing?.type ?? "",
        nightlyPhp: listing?.nightly_php ?? 0,
      });
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [bookingId]);

  return (
    <Sheet open={!!bookingId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle>Booking Details</SheetTitle>
        </SheetHeader>
        <div className="px-6 py-4">
          {loading && <DrawerSkeleton />}
          {error && !loading && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
          {detail && !loading && <DrawerContent detail={detail} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DrawerSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl" />
      <Skeleton className="h-20 w-full rounded-xl" />
    </div>
  );
}

function initials(name: string) {
  return (
    name.split(" ").filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?"
  );
}

function DrawerContent({ detail }: { detail: BookingDetail }) {
  const fmt = (d: string) => format(parseISO(d), "MMM d, yyyy");
  const fmtMaybe = (d: string | null) => (d ? format(parseISO(d), "MMM d, yyyy") : "—");
  const style = STATUS_STYLES[detail.status] ?? STATUS_STYLES.no_show;

  return (
    <div className="space-y-3">
      {/* Hero strip */}
      <div className={`rounded-xl border-l-4 ${style.border} ${style.bg} p-4`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight truncate">{detail.listingTitle}</p>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">#{detail.id.slice(0, 8)}</p>
          </div>
          <Badge className={`shrink-0 text-white text-[10px] capitalize ${STATUS_COLORS[detail.status] ?? "bg-gray-400"}`}>
            {detail.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Booked {fmt(detail.created_at)}</p>
      </div>

      {/* Stay timeline */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Stay</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Check-in</p>
            <p className="text-sm font-semibold">{format(parseISO(detail.check_in), "MMM d")}</p>
            <p className="text-[10px] text-muted-foreground">{format(parseISO(detail.check_in), "yyyy")}</p>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1">
              <div className="h-px w-6 bg-border" />
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="h-px w-6 bg-border" />
            </div>
            <span className="text-[10px] text-muted-foreground bg-secondary rounded-full px-2 py-0.5">
              {detail.nights}n
            </span>
          </div>
          <div className="flex-1 text-center">
            <p className="text-[10px] text-muted-foreground mb-0.5">Check-out</p>
            <p className="text-sm font-semibold">{format(parseISO(detail.check_out), "MMM d")}</p>
            <p className="text-[10px] text-muted-foreground">{format(parseISO(detail.check_out), "yyyy")}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Guests</p>
            <p className="text-sm font-semibold">{detail.guests}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Nightly</p>
            <p className="text-sm font-semibold">₱{detail.nightlyPhp.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground">Total</p>
            <p className="text-sm font-semibold">₱{detail.total_php.toLocaleString()}</p>
          </div>
        </div>
        {detail.confirmed_at && (
          <p className="text-[10px] text-muted-foreground">Confirmed {fmt(detail.confirmed_at)}</p>
        )}
      </div>

      {/* Guest + Host */}
      <div className="grid grid-cols-2 gap-3">
        <PersonCard label="Guest" name={detail.guestName} userId={detail.guest_id} />
        <PersonCard label="Host"  name={detail.hostName}  userId={detail.host_id} />
      </div>

      {/* Payment */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Payment</p>
        <IconRow icon={<CreditCard className="h-3.5 w-3.5" />}  label="Method"           value={detail.payment_method ?? "—"} />
        <IconRow icon={<span className="text-[11px] font-bold text-muted-foreground">₱</span>} label="Status" value={detail.payment_status ?? "—"} />
        <IconRow icon={<Receipt className="h-3.5 w-3.5" />}     label="Reference"         value={detail.payment_ref ?? "—"} />
        <IconRow icon={<Calendar className="h-3.5 w-3.5" />}    label="Refundable until"  value={fmtMaybe(detail.refundable_until)} />
        <IconRow icon={<Calendar className="h-3.5 w-3.5" />}    label="Payout release"    value={fmtMaybe(detail.payout_release_on)} />
      </div>

      {/* Property */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Property</p>
        <div className="flex items-start gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">{detail.listingTitle}</p>
            <p className="text-xs text-muted-foreground capitalize">{detail.listingType.replace(/_/g, " ")}</p>
            <p className="text-xs text-muted-foreground">
              {[detail.listingCity, detail.listingProvince].filter(Boolean).join(", ")}
            </p>
            {detail.listingAddress && (
              <p className="text-xs text-muted-foreground">{detail.listingAddress}</p>
            )}
          </div>
        </div>
      </div>

      {/* Notes */}
      {(detail.guest_message || detail.cancellation_reason) && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
          {detail.guest_message && (
            <div className="border-l-2 border-primary/40 pl-3">
              <p className="text-[10px] text-muted-foreground mb-1">Guest message</p>
              <p className="text-xs leading-relaxed">{detail.guest_message}</p>
            </div>
          )}
          {detail.cancellation_reason && (
            <div className="border-l-2 border-destructive/40 pl-3">
              <p className="text-[10px] text-muted-foreground mb-1">Cancellation reason</p>
              <p className="text-xs leading-relaxed">{detail.cancellation_reason}</p>
              {detail.cancelled_at && (
                <p className="text-[10px] text-muted-foreground mt-1">Cancelled {fmt(detail.cancelled_at)}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PersonCard({ label, name, userId }: { label: string; name: string; userId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 flex flex-col items-center text-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground self-start">
        {label}
      </p>
      <Avatar className="h-10 w-10">
        <AvatarFallback className="text-sm font-medium">{initials(name)}</AvatarFallback>
      </Avatar>
      <p className="text-xs font-medium leading-tight line-clamp-2">{name}</p>
      <Link
        to={`/admin/users?highlight=${userId}`}
        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline min-h-[44px]"
      >
        View in Users <ExternalLink className="h-2.5 w-2.5" />
      </Link>
    </div>
  );
}

function IconRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium ml-auto text-right break-all">{value}</span>
    </div>
  );
}
```

Note: `Fragment` is imported but not used in the new design — remove it if TypeScript warns. The `IconRow` and `PersonCard` helper components are file-private; do not export them.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: no errors. If `Fragment` is unused, remove it from the import.

- [ ] **Step 3: Commit**

```bash
git add src/components/BookingDetailDrawer.tsx
git commit -m "feat(admin): redesign BookingDetailDrawer with cards, timeline, and avatar sections"
```

---

### Task 2: Wire `BookingDetailDrawer` into `OverviewPage` calendar

**Files:**
- Modify: `src/pages/admin/OverviewPage.tsx`

**Interfaces:**
- Consumes: `<BookingDetailDrawer bookingId={string | null} onClose={() => void} />` from Task 1 (already in `src/components/BookingDetailDrawer.tsx`)
- Consumes: `Popover`, `PopoverContent`, `PopoverTrigger` from `@/components/ui/popover`
- `BookingCalendar` gains prop: `onSelectBooking: (id: string) => void`

- [ ] **Step 1: Rewrite `OverviewPage.tsx`**

Overwrite `src/pages/admin/OverviewPage.tsx` with the full content below:

```tsx
import { useCallback, useEffect, useState } from "react";
import {
  format, eachDayOfInterval, parseISO, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";

interface CalendarProps {
  bookings: Booking[];
  onSelectBooking: (id: string) => void;
}

function BookingCalendar({ bookings, onSelectBooking }: CalendarProps) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
        <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />{status}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}

        {days.map((day) => {
          const bks = bookings.filter((b) => {
            const ci = parseISO(b.check_in);
            const co = parseISO(b.check_out);
            return day >= ci && day < co;
          });

          const cellInner = (
            <>
              <span className={`text-[10px] font-medium ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5 mt-0.5">
                {bks.slice(0, 3).map((b) => (
                  <span key={b.id} className={`block h-1.5 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />
                ))}
                {bks.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{bks.length - 3}</span>
                )}
              </div>
            </>
          );

          if (bks.length === 0) {
            return (
              <div key={day.toISOString()} className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs">
                {cellInner}
              </div>
            );
          }

          if (bks.length === 1) {
            return (
              <button
                key={day.toISOString()}
                onClick={() => onSelectBooking(bks[0].id)}
                className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs text-left w-full hover:bg-secondary/40 transition-colors"
              >
                {cellInner}
              </button>
            );
          }

          return (
            <Popover key={day.toISOString()}>
              <PopoverTrigger asChild>
                <button className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs text-left w-full hover:bg-secondary/40 transition-colors">
                  {cellInner}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" align="start">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {format(day, "MMM d")} — {bks.length} bookings
                </p>
                <div className="space-y-1">
                  {bks.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => onSelectBooking(b.id)}
                      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-secondary transition-colors text-left min-h-[44px]"
                    >
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />
                      <span className="flex-1 truncate capitalize">{b.status}</span>
                      <span className="text-muted-foreground shrink-0">₱{b.total_php.toLocaleString()}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>
    </div>
  );
}

export default function OverviewPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [bookRes, ticketRes, appsRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at")
        .order("check_in", { ascending: false })
        .limit(300),
      supabase.from("support_tickets").select("id", { count: "exact", head: true }).in("status", ["open", "escalated"]),
      supabase.from("host_applications").select("id", { count: "exact", head: true }).in("status", ["pending", "manual_review"]),
    ]);
    setBookings((bookRes.data ?? []) as Booking[]);
    setOpenTickets(ticketRes.count ?? 0);
    setPendingApps(appsRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeBookings = bookings.filter((b) => b.status === "confirmed").length;

  return (
    <>
      <Seo title="Admin Overview · CheapStays" description="Admin overview." path="/admin/overview" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Overview</h1>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Active bookings</p>
              <p className="text-2xl font-semibold mt-1">{activeBookings}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Open tickets</p>
              <p className="text-2xl font-semibold mt-1">{openTickets}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Pending applications</p>
              <p className="text-2xl font-semibold mt-1">{pendingApps}</p>
            </Card>
          </div>
          <Card className="p-5">
            <BookingCalendar bookings={bookings} onSelectBooking={setSelectedId} />
          </Card>
        </div>
      )}
      <BookingDetailDrawer bookingId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

1. `npm run dev`
2. Sign in as admin, navigate to `/admin/overview`
3. Click a calendar day with 1 booking → drawer slides in with redesigned layout
4. Click a calendar day with 2+ bookings → popover appears listing all bookings; click one → drawer opens
5. Click a day with 0 bookings → nothing happens
6. Open drawer, click X or backdrop → drawer closes cleanly
7. Navigate to `/admin/bookings`, click a row → same drawer opens with new visual design
8. Verify skeleton renders correctly while loading (card-shaped blocks, not bare text lines)
9. Verify dark mode: open drawer in dark mode, check status hero strip uses dark variants

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/OverviewPage.tsx
git commit -m "feat(admin): wire BookingDetailDrawer into Overview calendar with popover for multi-booking days"
```
