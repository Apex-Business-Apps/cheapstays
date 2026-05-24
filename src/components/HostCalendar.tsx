import { useEffect, useMemo, useState } from "react";
import {
  addMonths, endOfMonth, format, isSameDay, parseISO, startOfMonth, subMonths,
  eachDayOfInterval, addDays,
} from "date-fns";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

type BookingRow = {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  flow_state: string;
  status: string;
  total_php: number;
  guest_id: string;
  listings: { title: string } | null;
};

type BlackoutRow = {
  id: string;
  listing_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
};

type DayMeta = {
  date: Date;
  bookings: BookingRow[];
  blackouts: BlackoutRow[];
};

type Props = { hostId: string };

const FLOW_STYLES: Record<string, string> = {
  requested: "bg-amber-200 dark:bg-amber-900/40",
  approved: "bg-emerald-200 dark:bg-emerald-900/40",
  auto_approved: "bg-emerald-200 dark:bg-emerald-900/40",
  active: "bg-sky-200 dark:bg-sky-900/40",
  cancel_requested: "bg-orange-200 dark:bg-orange-900/40",
  replacement_offered: "bg-violet-200 dark:bg-violet-900/40",
  replacement_accepted: "bg-violet-200 dark:bg-violet-900/40",
  completed: "bg-slate-200 dark:bg-slate-800",
  refunded: "bg-rose-200 dark:bg-rose-900/40",
  expired: "bg-rose-200 dark:bg-rose-900/40",
};

const BLACKOUT_STYLE = "bg-gray-300 dark:bg-gray-700 stripe";

export function HostCalendar({ hostId }: Props) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [blackouts, setBlackouts] = useState<BlackoutRow[]>([]);
  const [openDay, setOpenDay] = useState<DayMeta | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);

      // Fetch host's listings first to scope blackout lookups.
      const { data: listings } = await sb
        .from("listings")
        .select("id")
        .eq("host_id", hostId);
      const listingIds = (listings ?? []).map((l: { id: string }) => l.id);

      const [bRes, blRes] = await Promise.all([
        sb.from("bookings")
          .select("id,listing_id,check_in,check_out,flow_state,status,total_php,guest_id,listings(title)")
          .eq("host_id", hostId)
          .order("check_in", { ascending: true }),
        listingIds.length === 0
          ? Promise.resolve({ data: [], error: null })
          : sb.from("listing_blackout_dates")
              .select("id,listing_id,start_date,end_date,reason")
              .in("listing_id", listingIds),
      ]);

      if (cancelled) return;
      setBookings((bRes.data ?? []).map((b: Record<string, unknown>) => ({
        ...b,
        listings: Array.isArray(b.listings) ? (b.listings[0] ?? null) : b.listings,
      })) as BookingRow[]);
      setBlackouts((blRes.data ?? []) as BlackoutRow[]);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [hostId]);

  const days = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    return eachDayOfInterval({ start, end });
  }, [month]);

  function bookingsOnDay(day: Date): BookingRow[] {
    return bookings.filter((b) => {
      const ci = parseISO(b.check_in);
      const co = parseISO(b.check_out);
      return day >= ci && day < co;
    });
  }

  function blackoutsOnDay(day: Date): BlackoutRow[] {
    return blackouts.filter((bl) => {
      const s = parseISO(bl.start_date);
      const e = parseISO(bl.end_date);
      return day >= s && day <= e;
    });
  }

  const startDow = startOfMonth(month).getDay();

  if (loading) {
    return (
      <Card className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…
      </Card>
    );
  }

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">{format(month, "MMMM yyyy")}</h3>
          <p className="text-[11px] text-muted-foreground">
            Hover a day for a summary. Click to open booking details and edit blackouts.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost"
            onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost"
            onClick={() => setMonth(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button size="icon" variant="ghost"
            onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
        {["S","M","T","W","T","F","S"].map((d, i) => <div key={i}>{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: startDow }).map((_, i) => (
          <div key={`b-${i}`} />
        ))}
        {days.map((day) => {
          const bs = bookingsOnDay(day);
          const bls = blackoutsOnDay(day);
          const primary = bs[0]?.flow_state;
          const tooltipParts: string[] = [];
          if (bs.length > 0) tooltipParts.push(`${bs.length} booking${bs.length>1?"s":""}`);
          if (bls.length > 0) tooltipParts.push(`${bls.length} blackout${bls.length>1?"s":""}`);
          const tooltip = tooltipParts.join(" · ") || "Available";

          return (
            <button
              key={day.toISOString()}
              type="button"
              title={tooltip}
              onClick={() => setOpenDay({ date: day, bookings: bs, blackouts: bls })}
              className={cn(
                "aspect-square rounded-md text-xs flex flex-col items-center justify-start p-1 border border-border/40 transition-colors",
                "hover:border-primary/60",
                primary ? FLOW_STYLES[primary] : bls.length > 0 ? BLACKOUT_STYLE : "bg-background",
                isSameDay(day, new Date()) && "ring-1 ring-primary",
              )}
            >
              <span className="font-medium">{format(day, "d")}</span>
              {(bs.length > 0 || bls.length > 0) && (
                <span className="text-[9px] text-muted-foreground mt-auto">
                  {bs.length + bls.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[10px] pt-2 border-t border-border/40">
        {[
          ["Requested", "requested"], ["Approved", "approved"],
          ["Active", "active"], ["Replacement", "replacement_offered"],
          ["Completed", "completed"], ["Refunded/Expired", "refunded"],
        ].map(([label, key]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={cn("h-2.5 w-2.5 rounded", FLOW_STYLES[key])} />
            {label}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className={cn("h-2.5 w-2.5 rounded", BLACKOUT_STYLE)} />
          Blackout
        </span>
      </div>

      <Dialog open={openDay !== null} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openDay ? format(openDay.date, "EEEE, MMM d, yyyy") : ""}</DialogTitle>
            <DialogDescription>
              Bookings on this date are read-only — confirmed dates are locked.
              Use the blackout editor to mark this day unavailable for future stays.
            </DialogDescription>
          </DialogHeader>

          {openDay && (
            <div className="space-y-3">
              {openDay.bookings.length === 0 && openDay.blackouts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No bookings or blackouts on this day.
                </p>
              )}

              {openDay.bookings.map((b) => (
                <div key={b.id} className="rounded-md border border-border/60 p-3 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{b.listings?.title ?? "Listing"}</span>
                    <Badge variant="outline" className="text-[10px]">{b.flow_state}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}
                    {" · "} ₱{b.total_php.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Booking {b.id.slice(0,8)}… · status {b.status}
                  </p>
                </div>
              ))}

              {openDay.blackouts.map((bl) => (
                <div key={bl.id} className="rounded-md border border-dashed border-border/60 p-3 text-sm">
                  <p className="font-medium">Blackout</p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(bl.start_date), "MMM d")} → {format(parseISO(bl.end_date), "MMM d")}
                  </p>
                  {bl.reason && <p className="text-xs mt-1">{bl.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
