import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type CalendarState = "pending_payment" | "confirmed" | "cancelled" | "checkout_pending_review" | "dispute_hold" | "pending";
type DashboardEvent = { id: string; listing: string; start: string; end: string; status: CalendarState; amount: number; payout: string };

type Props = { hostId: string };

const statusStyle: Record<CalendarState, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  pending_payment: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300",
  confirmed: "bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-300",
  cancelled: "bg-rose-100 text-rose-900 dark:bg-rose-900/30 dark:text-rose-300",
  checkout_pending_review: "bg-violet-100 text-violet-900 dark:bg-violet-900/30 dark:text-violet-300",
  dispute_hold: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-300",
};

const payoutByPayment: Record<string, string> = {
  paid: "Scheduled",
  pending: "Pending release",
  unpaid: "Payment pending",
  failed: "Payment failed",
  refunded: "Refunded",
};

function toCalendarState(status: string, payment: string): CalendarState {
  if (status === "cancelled") return "cancelled";
  if (status === "pending") return "pending";
  if (status === "confirmed" && payment === "pending") return "pending_payment";
  if (status === "confirmed") return "confirmed";
  if (status === "completed") return "checkout_pending_review";
  if (payment === "failed") return "dispute_hold";
  return "pending";
}

const VERIFICATION_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ElementType }> = {
  verified:   { label: "Verified",         variant: "default",     icon: CheckCircle2 },
  pending:    { label: "Pending review",    variant: "secondary",   icon: Clock },
  unverified: { label: "Not yet verified",  variant: "outline",     icon: AlertCircle },
  rejected:   { label: "Needs attention",   variant: "destructive", icon: AlertCircle },
};

export function HostDashboard({ hostId }: Props) {
  const navigate = useNavigate();
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selected, setSelected] = useState<DashboardEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listingCount, setListingCount] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<string>("unverified");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);

      const [profileRes, bookingsRes, listingsRes] = await Promise.all([
        supabase.from("host_profiles").select("verification_status").eq("user_id", hostId).maybeSingle(),
        supabase
          .from("bookings")
          .select("id,check_in,check_out,status,payment_status,total_php,listings(title)")
          .eq("host_id", hostId)
          .order("check_in", { ascending: true })
          .limit(60),
        supabase.from("listings").select("id", { count: "exact", head: true }).eq("host_id", hostId).eq("status", "active"),
      ]);

      if (bookingsRes.error) {
        setError(bookingsRes.error.message);
        setLoading(false);
        return;
      }

      setVerificationStatus(profileRes.data?.verification_status ?? "unverified");
      setListingCount(listingsRes.count ?? 0);

      const mapped = (bookingsRes.data ?? []).map((b) => {
        const listing = Array.isArray(b.listings) ? b.listings[0]?.title : b.listings?.title;
        return {
          id: b.id,
          listing: listing ?? "Listing",
          start: b.check_in,
          end: b.check_out,
          status: toCalendarState(b.status, b.payment_status),
          amount: b.total_php,
          payout: payoutByPayment[b.payment_status] ?? "Pending",
        } as DashboardEvent;
      });

      setEvents(mapped);
      setSelected(mapped[0] ?? null);
      setLoading(false);

      if (profileRes.data?.verification_status === "rejected") {
        setError("Your verification was rejected. Contact support to resolve this and continue hosting.");
      }
    }
    load();
  }, [hostId]);

  const confirmedCount = useMemo(() => events.filter((e) => e.status === "confirmed").length, [events]);
  const pendingCount = useMemo(() => events.filter((e) => e.status === "pending").length, [events]);

  const verif = VERIFICATION_CONFIG[verificationStatus] ?? VERIFICATION_CONFIG.unverified;
  const VerifIcon = verif.icon;

  return (
    <div className="space-y-6">
      {/* Verification status */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <VerifIcon className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-sm text-muted-foreground">Identity verification</p>
              <p className="font-semibold">{verif.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={verif.variant}>{verif.label}</Badge>
            {(verificationStatus === "unverified" || verificationStatus === "rejected") && (
              <Button size="sm" variant="outline" asChild>
                <Link to="/support">Get verified</Link>
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Stat cards — all buttons navigate to real tabs */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active listings</p>
          <p className="text-2xl font-semibold mt-1">{listingCount}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/host/listings")}>
            Manage listings
          </Button>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pending bookings</p>
          <p className="text-2xl font-semibold mt-1">{pendingCount}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/host/bookings")}>
            Review requests
          </Button>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Confirmed stays</p>
          <p className="text-2xl font-semibold mt-1">{confirmedCount}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/host/bookings")}>
            View bookings
          </Button>
        </Card>
      </div>

      {/* Booking list */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Recent bookings</h3>
          <Button size="sm" variant="ghost" onClick={() => navigate("/host/bookings")} className="text-xs text-muted-foreground">
            View all →
          </Button>
        </div>

        {/* Status legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(Object.entries(statusStyle) as [CalendarState, string][]).map(([k, v]) => (
            <span key={k} className={`px-2 py-1 rounded-full ${v}`}>{k.replace(/_/g, " ")}</span>
          ))}
        </div>

        {loading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && events.length === 0 && (
          <p className="text-sm text-muted-foreground">No bookings yet. Once guests book your listings they appear here.</p>
        )}
        {!loading && events.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => setSelected(event)}
                className={`text-left border rounded-lg p-3 hover:border-primary transition-colors ${
                  selected?.id === event.id ? "border-primary" : "border-border"
                }`}
              >
                <p className="font-medium text-sm">{event.listing}</p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(event.start), "MMM d")} → {format(parseISO(event.end), "MMM d")}
                </p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full ${statusStyle[event.status]}`}>
                  {event.status.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {selected && !loading && (
          <Card className="p-4 bg-secondary/40" data-testid="booking-details">
            <p className="font-medium text-sm">Booking details</p>
            <p className="text-sm text-muted-foreground mt-1">
              {format(parseISO(selected.start), "PPP")} → {format(parseISO(selected.end), "PPP")}
            </p>
            <p className="text-sm">Total: ₱{selected.amount.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Payout: {selected.payout}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/host/bookings")}>
              Manage this booking →
            </Button>
          </Card>
        )}
      </Card>

      <Card className="p-5 flex flex-wrap justify-between gap-3">
        <div>
          <p className="font-medium">Need help?</p>
          <p className="text-sm text-muted-foreground">Support can verify docs, resolve disputes, and unblock payouts.</p>
        </div>
        <Button asChild variant="secondary">
          <Link to="/support">Open support</Link>
        </Button>
      </Card>
    </div>
  );
}
