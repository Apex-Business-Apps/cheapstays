// src/pages/admin/OverviewPage.tsx
import { useCallback, useEffect, useState } from "react";
import { format, eachDayOfInterval, parseISO, isSameDay, startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";

function BookingCalendar({ bookings }: { bookings: Booking[] }) {
  const [month, setMonth] = useState(new Date());
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startDow = startOfMonth(month).getDay();

  return (
    <div className="space-y-3">
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
                {bks.slice(0, 3).map((b) => <span key={b.id} className={`block h-1.5 rounded-full ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />)}
                {bks.length > 3 && <span className="text-[9px] text-muted-foreground">+{bks.length - 3}</span>}
              </div>
            </div>
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

  const load = useCallback(async () => {
    const [bookRes, ticketRes, appsRes] = await Promise.all([
      supabase.from("bookings").select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at").order("check_in", { ascending: false }).limit(300),
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
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="p-4"><p className="text-xs text-muted-foreground">Active bookings</p><p className="text-2xl font-semibold mt-1">{activeBookings}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Open tickets</p><p className="text-2xl font-semibold mt-1">{openTickets}</p></Card>
            <Card className="p-4"><p className="text-xs text-muted-foreground">Pending applications</p><p className="text-2xl font-semibold mt-1">{pendingApps}</p></Card>
          </div>
          <Card className="p-5"><BookingCalendar bookings={bookings} /></Card>
        </div>
      )}
    </>
  );
}
