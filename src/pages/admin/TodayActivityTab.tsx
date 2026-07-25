import { useEffect, useState } from "react";
import { format, addDays, parseISO } from "date-fns";
import { LogIn, LogOut, Tag } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

function SectionHeader({
  icon,
  title,
  count,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
        {icon}
      </span>
      <h2 className="text-sm font-semibold">{title}</h2>
      {count > 0 && (
        <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
          {count}
        </span>
      )}
    </div>
  );
}

function BookingRow({
  booking,
  accentBorder,
  onSelect,
}: {
  booking: TodayBooking;
  accentBorder: string;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(booking.id)}
      className={`w-full rounded-xl border border-border/60 border-l-4 ${accentBorder} bg-card p-3 text-left hover:bg-secondary/20 transition-colors min-h-[44px]`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">
            {booking.listings?.title ?? "Unknown listing"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(booking.check_in), "MMM d")} → {format(parseISO(booking.check_out), "MMM d")}
            {" · "}{booking.guests} guest{booking.guests !== 1 ? "s" : ""}
            {" · "}{booking.nights} night{booking.nights !== 1 ? "s" : ""}
          </p>
          <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
            {(booking.guest_id?.slice(0, 8) ?? "voucher")}…
          </p>
        </div>
        <p className="text-sm font-semibold shrink-0 mt-0.5">
          ₱{booking.total_php.toLocaleString()}
        </p>
      </div>
    </button>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border/60 py-5 text-center text-sm text-muted-foreground">
      {message}
    </p>
  );
}

function TabSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s} className="space-y-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-7 rounded-lg" />
            <Skeleton className="h-4 w-32" />
          </div>
          {Array.from({ length: 2 }).map((_, r) => (
            <Skeleton key={r} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayLocalStart = new Date();
    todayLocalStart.setHours(0, 0, 0, 0);
    const tomorrowLocalStart = new Date(todayLocalStart);
    tomorrowLocalStart.setDate(tomorrowLocalStart.getDate() + 1);

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
        .gte("redeemed_at", todayLocalStart.toISOString())
        .lt("redeemed_at", tomorrowLocalStart.toISOString())
        .not("redeemed_at", "is", null)
        .limit(50),
    ]).then(([arrRes, depRes, voucherRes]) => {
      setArrivals((arrRes.data ?? []) as unknown as TodayBooking[]);
      setDepartures((depRes.data ?? []) as unknown as TodayBooking[]);
      setVouchers((voucherRes.data ?? []) as unknown as TodayVoucher[]);
      setLoading(false);
    }).catch(() => {
      setError("Failed to load today's activity. Please refresh.");
      setLoading(false);
    });
  }, []);

  if (loading) return <TabSkeleton />;
  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div className="space-y-8">
      {/* Check-ins */}
      <div className="space-y-2">
        <SectionHeader
          icon={<LogIn className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />}
          title="Check-ins today"
          count={arrivals.length}
          accent="bg-emerald-100 dark:bg-emerald-950/50"
        />
        {arrivals.length === 0 ? (
          <EmptyState message="No check-ins today" />
        ) : (
          <div className="space-y-2">
            {arrivals.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                accentBorder="border-l-emerald-500"
                onSelect={onSelectBooking}
              />
            ))}
          </div>
        )}
      </div>

      {/* Check-outs */}
      <div className="space-y-2">
        <SectionHeader
          icon={<LogOut className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
          title="Check-outs today"
          count={departures.length}
          accent="bg-amber-100 dark:bg-amber-950/50"
        />
        {departures.length === 0 ? (
          <EmptyState message="No check-outs today" />
        ) : (
          <div className="space-y-2">
            {departures.map((b) => (
              <BookingRow
                key={b.id}
                booking={b}
                accentBorder="border-l-amber-400"
                onSelect={onSelectBooking}
              />
            ))}
          </div>
        )}
      </div>

      {/* Vouchers */}
      <div className="space-y-2">
        <SectionHeader
          icon={<Tag className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />}
          title="Vouchers redeemed today"
          count={vouchers.length}
          accent="bg-violet-100 dark:bg-violet-950/50"
        />
        {vouchers.length === 0 ? (
          <EmptyState message="No vouchers redeemed today" />
        ) : (
          <div className="space-y-2">
            {vouchers.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-border/60 border-l-4 border-l-violet-400 bg-card p-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-mono font-medium">{v.code}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {v.listings?.title ?? "Unknown listing"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Redeemed at {format(parseISO(v.redeemed_at), "h:mm a")}
                  </p>
                </div>
                <p className="text-sm font-semibold shrink-0 mt-0.5">
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
