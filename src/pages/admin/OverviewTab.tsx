import { useCallback, useEffect, useState } from "react";
import { startOfMonth, endOfMonth } from "date-fns";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { Booking } from "./types";

export function OverviewTab() {
  const [activeBookings, setActiveBookings] = useState(0);
  const [openTickets, setOpenTickets] = useState(0);
  const [pendingApps, setPendingApps] = useState(0);
  const [revenueThisMonth, setRevenueThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = startOfMonth(new Date()).toISOString();
    const monthEnd = endOfMonth(new Date()).toISOString();

    const [bookRes, ticketRes, appsRes, revenueRes] = await Promise.all([
      supabase
        .from("bookings")
        .select("id,status,check_out")
        .eq("status", "confirmed")
        .gte("check_out", today),
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

    setActiveBookings((bookRes.data as Booking[] | null)?.length ?? 0);
    setOpenTickets(ticketRes.count ?? 0);
    setPendingApps(appsRes.count ?? 0);
    setRevenueThisMonth((revenueRes.data ?? []).reduce((sum, b) => sum + b.total_php, 0));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  return (
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
  );
}
