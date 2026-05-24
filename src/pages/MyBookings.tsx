import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO, isPast } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Seo } from "@/components/Seo";
import { Loader2, CalendarDays, ArrowRight, CreditCard } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  listing_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_php: number;
  status: string;
  payment_status: string;
  created_at: string;
  listings: { title: string; city: string; province: string; images: string[]; slug: string | null } | null;
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  no_show: "bg-slate-100 text-slate-800",
};

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: "Payment pending",
  pending: "Processing",
  paid: "Paid",
  failed: "Payment failed",
  refunded: "Refunded",
};

function BookingCard({
  booking: b,
  onCancel,
  cancelling,
  onPay,
  paying,
}: {
  booking: Booking;
  onCancel: (id: string) => void;
  cancelling: string | null;
  onPay: (id: string) => void;
  paying: string | null;
}) {
  const listingHref = b.listings?.slug
    ? `/listing/slug/${b.listings.slug}`
    : `/listing/${b.listing_id}`;
  const heroImage = b.listings?.images?.[0];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {heroImage ? (
          <div className="sm:w-40 h-36 sm:h-auto shrink-0 overflow-hidden bg-secondary/40">
            <img src={heroImage} alt={b.listings?.title ?? ""} className="w-full h-full object-cover" loading="lazy" />
          </div>
        ) : (
          <div className="sm:w-40 h-36 sm:h-auto shrink-0 bg-secondary/60 flex items-center justify-center">
            <span className="text-3xl opacity-20">🏠</span>
          </div>
        )}
        <div className="flex-1 p-5">
          <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
            <div>
              <Link to={listingHref} className="font-medium hover:text-primary transition-colors line-clamp-1">
                {b.listings?.title ?? "Listing"}
              </Link>
              {b.listings && (
                <p className="text-xs text-muted-foreground">{b.listings.city}, {b.listings.province}</p>
              )}
            </div>
            <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full capitalize", STATUS_STYLES[b.status] ?? "bg-secondary text-secondary-foreground")}>
              {b.status}
            </span>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {format(parseISO(b.check_in), "MMM d")} – {format(parseISO(b.check_out), "MMM d, yyyy")}
            </span>
            <span>{b.nights} {b.nights === 1 ? "night" : "nights"} · {b.guests} {b.guests === 1 ? "guest" : "guests"}</span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">₱{b.total_php.toLocaleString()}</p>
              <p className="text-[10px] text-muted-foreground">{PAYMENT_LABELS[b.payment_status] ?? b.payment_status}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" variant="outline" asChild>
                <Link to={listingHref}>View listing</Link>
              </Button>
              {["pending", "confirmed"].includes(b.status) && b.payment_status === "unpaid" && (
                <Button
                  size="sm"
                  disabled={paying === b.id}
                  onClick={() => onPay(b.id)}
                  className="gap-1.5"
                >
                  {paying === b.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <CreditCard className="h-3.5 w-3.5" />}
                  Pay now
                </Button>
              )}
              {b.status === "pending" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  disabled={cancelling === b.id}
                  onClick={() => onCancel(b.id)}
                >
                  {cancelling === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cancel"}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function MyBookings() {
  const { user, loading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [paying, setPaying] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    supabase
      .from("bookings")
      .select("id,listing_id,check_in,check_out,nights,guests,total_php,status,payment_status,created_at,listings(title,city,province,images,slug)")
      .eq("guest_id", user.id)
      .order("check_in", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (error) {
          setFetchError(error.message);
        } else {
          setBookings(
            (data ?? []).map((b) => ({
              ...b,
              listings: Array.isArray(b.listings) ? (b.listings[0] ?? null) : b.listings,
            })) as Booking[]
          );
        }
        setLoading(false);
      });
  }, [user]);

  async function pay(bookingId: string) {
    setPaying(bookingId);
    try {
      const { data, error } = await supabase.functions.invoke("booking-checkout", {
        body: { booking_id: bookingId, payment_method: "gcash" },
      });
      if (error) throw error;
      if (data?.checkout_url) {
        window.location.href = data.checkout_url as string;
        return;
      }
      toast({ title: "Online payment unavailable", description: "Your booking is confirmed. You can pay at check-in." });
    } catch (err) {
      toast({ title: "Payment error", description: (err as Error).message, variant: "destructive" });
    } finally {
      setPaying(null);
    }
  }

  // Guest cancellation routes through the backend — direct UPDATEs to
  // bookings.status are rejected by the bookings_guard_critical_columns trigger.
  async function cancel(bookingId: string) {
    setCancelling(bookingId);
    try {
      const { error } = await supabase.functions.invoke("cancel-booking-guest", {
        body: { booking_id: bookingId, reason: "Guest cancelled from My Bookings" },
      });
      if (error) throw error;
      toast({ title: "Booking cancelled" });
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: "cancelled" } : b))
      );
    } catch (err) {
      let msg = (err as Error).message;
      try {
        const body = await (err as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: "Could not cancel", description: msg, variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  }

  if (authLoading || (loading && user)) {
    return (
      <div className="container py-24 flex justify-center">
        <Seo title="My Bookings · CheapStays" description="View and manage your stays." path="/my-bookings" />
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-24 max-w-md text-center">
        <Seo title="My Bookings · CheapStays" description="View and manage your stays." path="/my-bookings" />
        <h1 className="text-2xl font-semibold">Sign in to view your bookings</h1>
        <Button className="mt-6" asChild><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }

  const upcoming = bookings.filter((b) => !isPast(parseISO(b.check_out)) && b.status !== "cancelled");
  const past = bookings.filter((b) => isPast(parseISO(b.check_out)) || b.status === "cancelled");

  return (
    <div>
      <Seo title="My Bookings · CheapStays" description="View and manage your stays." path="/my-bookings" />
      <div className="container py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">My bookings</h1>
          <p className="text-muted-foreground mt-1">Your upcoming and past stays.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : fetchError ? (
          <div className="py-16 text-center text-muted-foreground">
            <p className="text-sm">Could not load bookings — {fetchError}</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-4 opacity-30" />
            <p className="text-lg">No bookings yet.</p>
            <Button asChild className="mt-6">
              <Link to="/search">Find a stay <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Upcoming</h2>
                <div className="space-y-4">
                  {upcoming.map((b) => (
                    <BookingCard key={b.id} booking={b} onCancel={cancel} cancelling={cancelling} onPay={pay} paying={paying} />
                  ))}
                </div>
              </section>
            )}
            {past.length > 0 && (
              <section>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Past & cancelled</h2>
                <div className="space-y-4">
                  {past.map((b) => (
                    <BookingCard key={b.id} booking={b} onCancel={cancel} cancelling={cancelling} onPay={pay} paying={paying} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
