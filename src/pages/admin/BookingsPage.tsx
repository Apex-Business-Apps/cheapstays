// src/pages/admin/BookingsPage.tsx
import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Seo } from "@/components/Seo";
import type { Booking } from "./types";
import { STATUS_COLORS } from "./types";
import { BookingDetailDrawer } from "@/components/BookingDetailDrawer";
import { AdminBookingsCalendar } from "@/components/admin/AdminBookingsCalendar";

type BookingRow = Booking & { listings: { title: string } | { title: string }[] | null };

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("bookings")
      .select("id,listing_id,guest_id,host_id,check_in,check_out,status,total_php,created_at,guest_name_snapshot,listings(title)")
      .order("check_in", { ascending: false }).limit(300);
    const rows = ((data ?? []) as unknown as BookingRow[]).map((b) => ({
      ...b,
      listings: Array.isArray(b.listings) ? (b.listings[0] ?? null) : b.listings,
    })) as Booking[];
    setBookings(rows);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const recent = bookings.slice(0, 20);

  return (
    <>
      <Seo title="Bookings · CheapStays Admin" description="All bookings." path="/admin/bookings" />
      <h1 className="text-2xl font-semibold tracking-tight mb-6">Bookings</h1>
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : (
        <div className="space-y-6">
          <AdminBookingsCalendar
            bookings={bookings}
            onSelectBooking={(id) => setSelectedId(id)}
          />

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Recent bookings</p>
            {recent.length === 0 && <p className="text-sm text-muted-foreground py-2">No bookings yet.</p>}
            {recent.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedId(b.id)}
                className="w-full flex items-center justify-between text-sm py-1.5 border-b border-border/40 hover:bg-secondary/40 rounded px-1 transition-colors min-h-[44px] text-left"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_COLORS[b.status] ?? "bg-gray-400"}`} />
                  <span className="truncate">
                    <span className="font-medium">{b.listings?.title ?? "Listing"}</span>
                    <span className="text-muted-foreground"> · {format(parseISO(b.check_in), "MMM d")} → {format(parseISO(b.check_out), "MMM d")}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary" className="text-[10px]">{b.status}</Badge>
                  <span className="text-muted-foreground text-xs">₱{b.total_php.toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <BookingDetailDrawer
        bookingId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </>
  );
}
