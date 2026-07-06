import { useCallback, useEffect, useState } from "react";
import {
  format, eachDayOfInterval, parseISO, isSameDay,
  startOfMonth, endOfMonth, addMonths, subMonths,
} from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
        <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setMonth((m) => subMonths(m, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
        <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <span key={status} className="flex items-center gap-1.5 capitalize">
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
      // Revenue attributed by booking-creation date (not check-in date) — intentional for booking-month reporting
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

  const today = new Date().toISOString().slice(0, 10);
  const activeBookings = bookings.filter(
    (b) => b.status === "confirmed" && b.check_out >= today
  ).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))}
        </div>
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-8 rounded-md" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="flex gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-3 w-16" />)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-[52px] rounded" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

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
