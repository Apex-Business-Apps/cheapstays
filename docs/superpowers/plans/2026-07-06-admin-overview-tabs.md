# Admin Overview Three-Tab Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the admin Overview page into three tabs — Overview (existing content + revenue card), Today's Activity (arrivals, departures, vouchers), and Alerts (pending confirmations, urgent tickets, disbursement issues).

**Architecture:** `OverviewPage.tsx` becomes a thin Tabs shell that mounts `BookingDetailDrawer` once and renders one of three sub-components per tab. Each sub-component owns its own Supabase queries and local state. No shared data-fetching layer needed — each tab loads independently on render.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn/ui (`Tabs`, `Badge`, `Button`, `Card`), date-fns, react-router-dom `Link`, Supabase browser client

## Global Constraints

- No new npm packages
- Tailwind only — no inline styles
- `min-h-[44px]` on every interactive element
- All status and method values use the `capitalize` CSS class
- `BookingDetailDrawer` props unchanged: `{ bookingId: string | null; onClose: () => void }`
- `<TabsContent>` required for every `<TabsTrigger>` (Radix requirement — missing it causes a rendering error)
- TypeScript must be clean (`npx tsc --noEmit` exits 0) after each task

---

## File Map

| Action | Path | Change |
|--------|------|--------|
| Create | `src/pages/admin/OverviewTab.tsx` | Stat cards (4) + booking calendar — extracted from OverviewPage |
| Create | `src/pages/admin/TodayActivityTab.tsx` | Arrivals, departures, vouchers redeemed today |
| Create | `src/pages/admin/AlertsTab.tsx` | Pending confirmations, urgent tickets, disbursement issues |
| Modify | `src/pages/admin/OverviewPage.tsx` | Replace with Tabs shell; import all three tabs |

---

### Task 1: Create `OverviewTab.tsx`

**Files:**
- Create: `src/pages/admin/OverviewTab.tsx`

**Interfaces:**
- Consumes: `Booking` type and `STATUS_COLORS` from `./types`; `supabase` from `@/integrations/supabase/client`
- Produces: `export function OverviewTab({ onSelectBooking }: { onSelectBooking: (id: string) => void })` — used by Task 4

- [ ] **Step 1: Create the file with the complete component**

Create `src/pages/admin/OverviewTab.tsx` with this exact content:

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
                type="button"
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
                <button
                  type="button"
                  className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs text-left w-full hover:bg-secondary/40 transition-colors"
                >
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
                      type="button"
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

export function OverviewTab({ onSelectBooking }: { onSelectBooking: (id: string) => void }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [bookRes, ticketRes, appsRes, revenueRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at")
        .order("check_in", { ascending: false })
        .limit(300),
      supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "escalated"]),
      supabase
        .from("host_applications")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "manual_review"]),
      supabase
        .from("bookings")
        .select("total_php")
        .eq("status", "confirmed")
        .gte("created_at", monthStart)
        .lte("created_at", monthEnd),
    ]);

    setBookings((bookRes.data ?? []) as Booking[]);
    setOpenTickets(ticketRes.count ?? 0);
    setPendingApps(appsRes.count ?? 0);
    setRevenueThisMonth((revenueRes.data ?? []).reduce((sum, b) => sum + b.total_php, 0));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const activeBookings = bookings.filter((b) => b.status === "confirmed").length;

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Revenue this month</p>
          <p className="text-2xl font-semibold mt-1">₱{revenueThisMonth.toLocaleString()}</p>
        </Card>
      </div>
      <Card className="p-5">
        <BookingCalendar bookings={bookings} onSelectBooking={onSelectBooking} />
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/OverviewTab.tsx
git commit -m "feat(admin): extract OverviewTab with 4 stat cards and booking calendar"
```

---

### Task 2: Create `TodayActivityTab.tsx`

**Files:**
- Create: `src/pages/admin/TodayActivityTab.tsx`

**Interfaces:**
- Consumes: `supabase` client; `format`, `addDays`, `parseISO` from date-fns
- Produces: `export function TodayActivityTab({ onSelectBooking }: { onSelectBooking: (id: string) => void })` — used by Task 4

- [ ] **Step 1: Create the file with the complete component**

Create `src/pages/admin/TodayActivityTab.tsx` with this exact content:

```tsx
import { useEffect, useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

interface TodayBooking {
  id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_php: number;
  status: string;
  listings: { title: string } | null;
}

interface TodayVoucher {
  id: string;
  code: string;
  amount_paid: number;
  redeemed_at: string;
  listings: { title: string } | null;
}

function BookingRow({
  booking,
  onSelect,
}: {
  booking: TodayBooking;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(booking.id)}
      className="w-full rounded-xl border border-border/60 bg-card p-3 text-left hover:bg-secondary/20 transition-colors min-h-[44px] flex items-center justify-between gap-3"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">
          {booking.listings?.title ?? "Unknown listing"}
        </p>
        <p className="text-xs text-muted-foreground">
          {booking.guests} guest{booking.guests !== 1 ? "s" : ""} ·{" "}
          {booking.nights} night{booking.nights !== 1 ? "s" : ""}
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          {booking.guest_id.slice(0, 8)}…
        </p>
      </div>
      <p className="text-sm font-semibold shrink-0">
        ₱{booking.total_php.toLocaleString()}
      </p>
    </button>
  );
}

export function TodayActivityTab({
  onSelectBooking,
}: {
  onSelectBooking: (id: string) => void;
}) {
  const [arrivals, setArrivals] = useState<TodayBooking[]>([]);
  const [departures, setDepartures] = useState<TodayBooking[]>([]);
  const [vouchers, setVouchers] = useState<TodayVoucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

    Promise.all([
      supabase
        .from("bookings")
        .select("id,guest_id,check_in,check_out,nights,guests,total_php,status,listings(title)")
        .eq("check_in", today)
        .eq("status", "confirmed")
        .limit(50),
      supabase
        .from("bookings")
        .select("id,guest_id,check_in,check_out,nights,guests,total_php,status,listings(title)")
        .eq("check_out", today)
        .eq("status", "confirmed")
        .limit(50),
      supabase
        .from("vouchers")
        .select("id,code,amount_paid,redeemed_at,listings(title)")
        .gte("redeemed_at", today)
        .lt("redeemed_at", tomorrow)
        .not("redeemed_at", "is", null)
        .limit(50),
    ]).then(([arrRes, depRes, voucherRes]) => {
      setArrivals((arrRes.data ?? []) as unknown as TodayBooking[]);
      setDepartures((depRes.data ?? []) as unknown as TodayBooking[]);
      setVouchers((voucherRes.data ?? []) as unknown as TodayVoucher[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Check-ins today</h2>
        {arrivals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-ins today</p>
        ) : (
          <div className="space-y-2">
            {arrivals.map((b) => (
              <BookingRow key={b.id} booking={b} onSelect={onSelectBooking} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Check-outs today</h2>
        {departures.length === 0 ? (
          <p className="text-sm text-muted-foreground">No check-outs today</p>
        ) : (
          <div className="space-y-2">
            {departures.map((b) => (
              <BookingRow key={b.id} booking={b} onSelect={onSelectBooking} />
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold">Vouchers redeemed today</h2>
        {vouchers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No vouchers redeemed today</p>
        ) : (
          <div className="space-y-2">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-mono font-medium">{v.code}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.listings?.title ?? "Unknown listing"}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Redeemed at {format(parseISO(v.redeemed_at), "h:mm a")}
                  </p>
                </div>
                <p className="text-sm font-semibold shrink-0">
                  ₱{v.amount_paid.toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/TodayActivityTab.tsx
git commit -m "feat(admin): add TodayActivityTab with arrivals, departures, and vouchers"
```

---

### Task 3: Create `AlertsTab.tsx`

**Files:**
- Create: `src/pages/admin/AlertsTab.tsx`

**Interfaces:**
- Consumes: `supabase` client; `formatDistanceToNow`, `parseISO` from date-fns; `Link` from react-router-dom; `Badge`, `Button` from shadcn/ui
- Produces: `export function AlertsTab({ onSelectBooking }: { onSelectBooking: (id: string) => void })` — used by Task 4

- [ ] **Step 1: Create the file with the complete component**

Create `src/pages/admin/AlertsTab.tsx` with this exact content:

```tsx
import { useEffect, useState, type ReactNode } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface PendingBooking {
  id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  total_php: number;
  created_at: string;
  listings: { title: string } | null;
}

interface UrgentTicket {
  id: string;
  ticket_num: number;
  subject: string;
  status: string;
  priority: string;
  escalated: boolean;
  created_at: string;
}

interface DisbursementIssue {
  id: string;
  amount: number;
  status: string;
  payout_method: string;
  retry_count: number;
  requested_at: string;
  failure_reason: string | null;
}

function AlertSection({
  title,
  count,
  badgeColor,
  children,
}: {
  title: string;
  count: number;
  badgeColor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        {count > 0 && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full text-white ${badgeColor}`}
          >
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function AlertsTab({
  onSelectBooking,
}: {
  onSelectBooking: (id: string) => void;
}) {
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [urgentTickets, setUrgentTickets] = useState<UrgentTicket[]>([]);
  const [disbursementIssues, setDisbursementIssues] = useState<DisbursementIssue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase
        .from("bookings")
        .select("id,guest_id,check_in,check_out,total_php,created_at,listings(title)")
        .eq("flow_state", "requested")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("support_tickets")
        .select("id,ticket_num,subject,status,priority,escalated,created_at")
        .or("escalated.eq.true,priority.eq.urgent")
        .neq("status", "resolved")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("disbursement_requests")
        .select("id,amount,status,payout_method,retry_count,requested_at,failure_reason")
        .in("status", ["pending", "failed"])
        .order("requested_at", { ascending: false })
        .limit(50),
    ]).then(([bookRes, ticketRes, disbRes]) => {
      setPendingBookings((bookRes.data ?? []) as unknown as PendingBooking[]);
      setUrgentTickets((ticketRes.data ?? []) as unknown as UrgentTicket[]);
      setDisbursementIssues((disbRes.data ?? []) as unknown as DisbursementIssue[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  const allClear =
    pendingBookings.length === 0 &&
    urgentTickets.length === 0 &&
    disbursementIssues.length === 0;

  if (allClear) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        <p className="text-sm font-medium">No alerts — everything looks good</p>
        <p className="text-xs text-muted-foreground">
          No pending confirmations, urgent tickets, or disbursement issues.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending confirmations */}
      <AlertSection
        title="Pending confirmations"
        count={pendingBookings.length}
        badgeColor="bg-amber-500"
      >
        {pendingBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear</p>
        ) : (
          <div className="space-y-2">
            {pendingBookings.map((b) => (
              <div
                key={b.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {b.listings?.title ?? "Unknown listing"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {b.check_in} → {b.check_out} · ₱{b.total_php.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(b.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 min-h-[44px]"
                  onClick={() => onSelectBooking(b.id)}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        )}
      </AlertSection>

      {/* Urgent support issues */}
      <AlertSection
        title="Urgent support issues"
        count={urgentTickets.length}
        badgeColor="bg-red-500"
      >
        {urgentTickets.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear</p>
        ) : (
          <div className="space-y-2">
            {urgentTickets.map((t) => (
              <div
                key={t.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    #{t.ticket_num} — {t.subject}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {t.escalated && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Escalated
                      </Badge>
                    )}
                    {t.priority === "urgent" && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                        Urgent
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {formatDistanceToNow(parseISO(t.created_at), { addSuffix: true })}
                  </p>
                </div>
                <Link
                  to="/admin/tickets"
                  className="shrink-0 text-xs text-primary hover:underline min-h-[44px] flex items-center"
                >
                  View ticket
                </Link>
              </div>
            ))}
          </div>
        )}
      </AlertSection>

      {/* Disbursement issues */}
      <AlertSection
        title="Disbursement issues"
        count={disbursementIssues.length}
        badgeColor="bg-amber-500"
      >
        {disbursementIssues.length === 0 ? (
          <p className="text-sm text-muted-foreground">All clear</p>
        ) : (
          <div className="space-y-2">
            {disbursementIssues.map((d) => (
              <div
                key={d.id}
                className="rounded-xl border border-border/60 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">₱{d.amount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {d.payout_method.replace(/_/g, " ")}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 capitalize ${
                        d.status === "failed"
                          ? "border-red-400 text-red-500"
                          : "border-amber-400 text-amber-500"
                      }`}
                    >
                      {d.status}
                    </Badge>
                    {d.retry_count > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {d.retry_count} {d.retry_count === 1 ? "retry" : "retries"}
                      </span>
                    )}
                  </div>
                  {d.failure_reason && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {d.failure_reason}
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(parseISO(d.requested_at), { addSuffix: true })}
                  </p>
                </div>
                <Link
                  to="/admin/disbursements"
                  className="shrink-0 text-xs text-primary hover:underline min-h-[44px] flex items-center"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </AlertSection>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/AlertsTab.tsx
git commit -m "feat(admin): add AlertsTab with pending confirmations, urgent tickets, disbursement issues"
```

---

### Task 4: Refactor `OverviewPage.tsx` into Tabs shell

**Files:**
- Modify: `src/pages/admin/OverviewPage.tsx`

**Interfaces:**
- Consumes: `OverviewTab` from `./OverviewTab`; `TodayActivityTab` from `./TodayActivityTab`; `AlertsTab` from `./AlertsTab`; `BookingDetailDrawer` from `@/components/BookingDetailDrawer`; `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` from `@/components/ui/tabs`
- Produces: default export `OverviewPage` — registered in `App.tsx` as the `/admin/overview` route (no change to routing needed)

**Important:** `<TabsContent>` must wrap every `<TabsTrigger>`'s content — Radix UI requires this. Missing `<TabsContent>` causes a synchronous rendering error (see CLAUDE.md regression notes).

- [ ] **Step 1: Replace `OverviewPage.tsx` with the Tabs shell**

Overwrite `src/pages/admin/OverviewPage.tsx` with this exact content:

```tsx
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Seo } from "@/components/Seo";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import { OverviewTab } from "./OverviewTab";
import { TodayActivityTab } from "./TodayActivityTab";
import { AlertsTab } from "./AlertsTab";

export default function OverviewPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <>
      <Seo title="Admin Overview · CheapStays" description="Admin overview." path="/admin/overview" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Overview</h1>
      <Tabs defaultValue="overview">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="today">Today's Activity</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab onSelectBooking={setSelectedId} />
        </TabsContent>
        <TabsContent value="today">
          <TodayActivityTab onSelectBooking={setSelectedId} />
        </TabsContent>
        <TabsContent value="alerts">
          <AlertsTab onSelectBooking={setSelectedId} />
        </TabsContent>
      </Tabs>
      <BookingDetailDrawer bookingId={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Run unit tests**

```bash
cd /Users/markme/Desktop/Projects/cheapstays && npm test -- --run
```

Expected: 100 passed (21 test files). No regressions — none of the existing unit tests cover OverviewPage.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/OverviewPage.tsx
git commit -m "feat(admin): restructure Overview page into Overview / Today's Activity / Alerts tabs"
```
