import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, AlertCircle, Clock, ChevronRight, ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type CalendarState = "pending_payment" | "confirmed" | "cancelled" | "checkout_pending_review" | "dispute_hold" | "pending";
type DashboardEvent = {
  id: string; listing: string; start: string; end: string; status: CalendarState;
  amount: number; payout: string; createdAt: string;
};

const STATUS_LABEL: Record<CalendarState, string> = {
  pending: "Pending",
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  cancelled: "Cancelled",
  checkout_pending_review: "Checkout pending review",
  dispute_hold: "Dispute hold",
};

const STATUS_DOT: Record<CalendarState, string> = {
  pending: "bg-amber-500",
  pending_payment: "bg-amber-500",
  confirmed: "bg-sky-500",
  cancelled: "bg-rose-500",
  checkout_pending_review: "bg-violet-500",
  dispute_hold: "bg-red-500",
};

type Props = { hostId: string };

const STATUS_BADGE: Record<CalendarState, string> = {
  pending: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  pending_payment: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  confirmed: "bg-sky-100 text-sky-900 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800",
  cancelled: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
  checkout_pending_review: "bg-violet-100 text-violet-900 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800",
  dispute_hold: "bg-red-100 text-red-900 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800",
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
          .select("id,check_in,check_out,status,payment_status,total_php,created_at,listings(title)")
          .eq("host_id", hostId)
          .order("created_at", { ascending: false })
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
          createdAt: (b as { created_at?: string }).created_at ?? b.check_in,
        } as DashboardEvent;
      });

      setEvents(mapped);
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

      {/* Recent bookings */}
      <Card className="p-0 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h3 className="font-semibold">Recent bookings</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {events.length === 0
                ? "Your latest bookings will appear here."
                : `Latest ${Math.min(4, events.length)} of ${events.length}`}
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-destructive px-5 pb-5">{error}</p>
        )}

        {!loading && !error && events.length === 0 && (
          <p className="text-sm text-muted-foreground px-5 pb-5">
            No bookings yet. Once guests book your listings they appear here.
          </p>
        )}

        {!loading && !error && events.length > 0 && (
          <>
            <ul className="divide-y divide-border border-y border-border">
              {events.slice(0, 4).map((event) => (
                <li key={event.id}>
                  <Link
                    to="/host/bookings"
                    className="group flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition-colors"
                  >
                    <span
                      className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[event.status]}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <p className="font-medium text-sm truncate">{event.listing}</p>
                        <span
                          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border shrink-0 ${STATUS_BADGE[event.status]}`}
                        >
                          {STATUS_LABEL[event.status]}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {format(parseISO(event.start), "MMM d")} → {format(parseISO(event.end), "MMM d, yyyy")}
                        <span className="mx-1.5 text-border">·</span>
                        {event.payout}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold tabular-nums">
                        ₱{event.amount.toLocaleString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground shrink-0 transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
            <div className="px-5 py-3 flex justify-end">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate("/host/bookings")}
                className="text-xs"
              >
                View all bookings
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          </>
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
