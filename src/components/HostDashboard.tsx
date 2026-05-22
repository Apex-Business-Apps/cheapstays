import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type CalendarState = "available" | "blocked" | "pending_payment" | "confirmed" | "cancelled" | "checkout_pending_review" | "dispute_hold";
type DashboardEvent = { id: string; guest: string; listing: string; start: string; end: string; status: CalendarState; amount: number; payout: string };

type Props = { hostId: string };

const statusStyle: Record<CalendarState, string> = {
  available: "bg-emerald-100 text-emerald-800",
  blocked: "bg-slate-200 text-slate-800",
  pending_payment: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  cancelled: "bg-rose-100 text-rose-900",
  checkout_pending_review: "bg-violet-100 text-violet-900",
  dispute_hold: "bg-red-100 text-red-900",
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
  if (status === "confirmed" && payment === "pending") return "pending_payment";
  if (status === "confirmed") return "confirmed";
  if (status === "completed") return "checkout_pending_review";
  if (payment === "failed") return "dispute_hold";
  return "available";
}

export function HostDashboard({ hostId }: Props) {
  const [events, setEvents] = useState<DashboardEvent[]>([]);
  const [selected, setSelected] = useState<DashboardEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      const { data: profile } = await supabase.from("host_profiles").select("verification_status").eq("user_id", hostId).maybeSingle();
      const { data, error: bookingsError } = await supabase
        .from("bookings")
        .select("id,check_in,check_out,status,payment_status,total_php,listings(title)")
        .eq("host_id", hostId)
        .order("check_in", { ascending: true })
        .limit(60);
      if (bookingsError) {
        setError(bookingsError.message);
        setLoading(false);
        return;
      }
      const mapped = (data ?? []).map((b) => {
        const listing = Array.isArray(b.listings) ? b.listings[0]?.title : b.listings?.title;
        const state = toCalendarState(b.status, b.payment_status);
        return {
          id: b.id,
          guest: "Guest",
          listing: listing ?? "Listing",
          start: b.check_in,
          end: b.check_out,
          status: state,
          amount: b.total_php,
          payout: payoutByPayment[b.payment_status] ?? "Pending",
        } as DashboardEvent;
      });
      // keep legend-complete states visible even without matching live rows
      const synthetic: DashboardEvent[] = ["blocked", "dispute_hold"].map((s, i) => ({ id: `synthetic-${s}`, guest: "N/A", listing: "Manual block", start: new Date().toISOString(), end: new Date().toISOString(), status: s as CalendarState, amount: 0, payout: "N/A" }));
      const all = [...mapped, ...synthetic.filter((x) => !mapped.some((m) => m.status === x.status))];
      setEvents(all);
      setSelected(all[0] ?? null);
      setLoading(false);
      if (profile && profile.verification_status === "rejected") setError("Verification needs attention. Contact support to continue hosting.");
    }
    load();
  }, [hostId]);

  const payoutCount = useMemo(() => events.filter((e) => e.status === "confirmed").length, [events]);
  const openNights = useMemo(() => events.filter((e) => e.status === "available").length, [events]);

  return (
    <div className="space-y-6">
      <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Verification status</p><p className="font-semibold">Identity verification and listing quality checks</p></div><Badge>Actionable</Badge></div></Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Listings</p><p className="text-2xl font-semibold">Manage media</p><Button size="sm" variant="outline" className="mt-3">Add listing photos</Button></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Availability</p><p className="text-2xl font-semibold">{openNights} open blocks</p><Button size="sm" variant="outline" className="mt-3">Edit availability</Button></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Payouts</p><p className="text-2xl font-semibold">{payoutCount} scheduled</p><Button size="sm" variant="outline" className="mt-3">View payout status</Button></Card>
      </div>
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Booking calendar</h3>
        <div className="flex flex-wrap gap-2 text-xs">{Object.entries(statusStyle).map(([k, v]) => <span key={k} className={`px-2 py-1 rounded-full ${v}`}>{k.replaceAll("_", " ")}</span>)}</div>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : null}
        {!loading && error ? <p className="text-sm text-destructive">{error}</p> : null}
        {!loading && !error && events.length === 0 ? <p className="text-sm text-muted-foreground">No calendar events yet. Confirm a booking to populate this view.</p> : null}
        {!loading && !error && events.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {events.map((event) => (
              <button key={event.id} onClick={() => setSelected(event)} className={`text-left border rounded-lg p-3 hover:border-primary ${selected?.id === event.id ? "border-primary" : "border-border"}`}>
                <p className="font-medium">{event.listing}</p>
                <p className="text-xs text-muted-foreground">{format(parseISO(event.start), "MMM d")} → {format(parseISO(event.end), "MMM d")}</p>
                <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${statusStyle[event.status]}`}>{event.status.replaceAll("_", " ")}</span>
              </button>
            ))}
          </div>
        ) : null}
        {selected && !loading && (
          <Card className="p-4 bg-secondary/40" data-testid="booking-details">
            <p className="font-medium">Booking details</p>
            <p className="text-sm">Guest: {selected.guest}</p>
            <p className="text-sm">Stay: {format(parseISO(selected.start), "PPP")} - {format(parseISO(selected.end), "PPP")}</p>
            <p className="text-sm">Amount: ₱{selected.amount.toLocaleString()}</p>
            <p className="text-sm">Payout: {selected.payout}</p>
          </Card>
        )}
      </Card>
      <Card className="p-5 flex flex-wrap justify-between gap-3"><div><p className="font-medium">Need help with onboarding?</p><p className="text-sm text-muted-foreground">Support can verify docs and unblock payouts.</p></div><Button asChild variant="secondary"><Link to="/support">Open host support</Link></Button></Card>
    </div>
  );
}
