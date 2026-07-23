import { useCallback, useEffect, useMemo, useState } from "react";
import {
  format, eachDayOfInterval, parseISO, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";

type ListingLite = { id: string; title: string };

function bookingsOnDay(bookings: Booking[], day: Date): Booking[] {
  return bookings.filter((b) => {
    if (b.status === "cancelled") return false;
    const ci = parseISO(b.check_in);
    const co = parseISO(b.check_out);
    return day >= ci && day < co;
  });
}

export function CalendarTab({ onSelectBooking }: { onSelectBooking: (id: string) => void }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [listings, setListings] = useState<Map<string, ListingLite>>(new Map());
  const [totalListings, setTotalListings] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const [bookRes, listingRes, countRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at")
        .order("check_in", { ascending: false })
        .limit(500),
      supabase.from("listings").select("id,title"),
      supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
    ]);

    setBookings((bookRes.data ?? []) as Booking[]);
    const map = new Map<string, ListingLite>();
    for (const l of (listingRes.data ?? []) as ListingLite[]) map.set(l.id, l);
    setListings(map);
    setTotalListings(countRes.count ?? 0);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }),
    [month],
  );
  const startDow = startOfMonth(month).getDay();

  const openDayBookings = useMemo(
    () => (openDay ? bookingsOnDay(bookings, openDay) : []),
    [openDay, bookings],
  );

  if (loading) {
    return (
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-md" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <>
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold">{format(month, "MMMM yyyy")}</h3>
            <p className="text-[11px] text-muted-foreground">
              Each cell shows how many active listings are booked vs vacant that day.
              Click a day to see every booking on it.
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={() => setMonth((m) => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(new Date()))}>
              Today
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-[10px] uppercase tracking-wide text-muted-foreground text-center">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
          {days.map((day) => {
            const bks = bookingsOnDay(bookings, day);
            const bookedListingIds = new Set(bks.map((b) => b.listing_id));
            const bookedCount = bookedListingIds.size;
            const vacantCount = Math.max(totalListings - bookedCount, 0);
            const isToday = isSameDay(day, new Date());
            const clickable = bks.length > 0;

            return (
              <button
                key={day.toISOString()}
                type="button"
                disabled={!clickable}
                onClick={() => setOpenDay(day)}
                className={cn(
                  "min-h-[80px] rounded-md border p-1.5 text-left flex flex-col transition-colors",
                  "border-border/40",
                  clickable ? "hover:bg-secondary/50 hover:border-primary/60 cursor-pointer" : "cursor-default",
                  isToday && "ring-1 ring-primary",
                )}
              >
                <span className={cn(
                  "text-xs font-semibold",
                  isToday ? "text-primary" : "text-foreground",
                )}>
                  {format(day, "d")}
                </span>
                <div className="mt-auto space-y-0.5">
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{bookedCount}</span> booked
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{vacantCount}</span> vacant
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/40">
          <p className="text-[11px] text-muted-foreground">
            Total active listings: <span className="font-semibold text-foreground">{totalListings}</span>
          </p>
          <div className="flex flex-wrap gap-3 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Booked
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Vacant
            </span>
          </div>
        </div>
      </Card>

      <Dialog open={openDay !== null} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openDay ? format(openDay, "EEEE, MMM d, yyyy") : ""}</DialogTitle>
            <DialogDescription>
              {openDayBookings.length} booking{openDayBookings.length === 1 ? "" : "s"} on this day.
              Click a booking to open details.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {openDayBookings.length === 0 && (
              <p className="text-sm text-muted-foreground">No bookings on this day.</p>
            )}
            {openDayBookings.map((b) => {
              const listing = listings.get(b.listing_id);
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setOpenDay(null); onSelectBooking(b.id); }}
                  className="w-full rounded-md border border-border/60 p-3 text-sm space-y-1 text-left hover:bg-secondary/40 transition-colors min-h-[44px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{listing?.title ?? "Listing"}</span>
                    <Badge variant="outline" className="text-[10px] capitalize shrink-0">
                      <span className={cn("h-1.5 w-1.5 rounded-full mr-1", STATUS_COLORS[b.status] ?? "bg-gray-400")} />
                      {b.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}
                    {" · "} ₱{b.total_php.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{b.id.slice(0, 8)}…</p>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
