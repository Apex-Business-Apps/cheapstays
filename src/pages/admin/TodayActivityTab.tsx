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
