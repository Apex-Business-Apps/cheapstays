// src/pages/admin/BookingsPage.tsx
import { useCallback, useEffect, useState } from "react";
import { format, eachDayOfInterval, parseISO, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date());

  const load = useCallback(async () => {
    const { data } = await supabase.from("bookings")
      .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at")
      .order("check_in", { ascending: false }).limit(300);
    setBookings((data ?? []) as Booking[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  const monthBookings = bookings.filter((b) => {
    const ci = parseISO(b.check_in);
    return ci >= startOfMonth(month) && ci <= endOfMonth(month);
  }).sort((a, b) => a.check_in.localeCompare(b.check_in));

  return (
    <>
      <Seo title="Bookings · CheapStays Admin" description="All bookings." path="/admin/bookings" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Bookings</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => subMonths(m, 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="font-medium text-sm">{format(month, "MMMM yyyy")}</span>
            <Button variant="ghost" size="sm" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex flex-wrap gap-3 text-xs">
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <span key={status} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{status}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map((d) => <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>)}
            {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
            {days.map((day) => {
              const bks = bookings.filter((b) => { const ci = parseISO(b.check_in); const co = parseISO(b.check_out); return day >= ci && day < co; });
              return (
                <div key={day.toISOString()} className="min-h-[52px] border border-border/30 rounded p-0.5 text-xs">
                  <span className={`text-[10px] font-medium ${isSameDay(day, new Date()) ? "text-primary" : "text-muted-foreground"}`}>{format(day, "d")}</span>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    {bks.slice(0, 3).map((b) => <span key={b.id} className={`block h-1.5 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} title={`${b.status} · ₱${b.total_php}`} />)}
                    {bks.length > 3 && <span className="text-[9px] text-muted-foreground">+{bks.length - 3}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5 pt-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">This month</p>
            {monthBookings.length === 0 && <p className="text-sm text-muted-foreground py-2">No bookings this month.</p>}
            {monthBookings.map((b) => (
              <div key={b.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />
                  <span>{format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">{b.status}</Badge>
                  <span className="text-muted-foreground text-xs">₱{b.total_php.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
