import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type CalendarState = "available" | "blocked" | "pending_payment" | "confirmed" | "cancelled" | "checkout_pending_review" | "dispute_hold";

type HostEvent = { id: string; guest: string; listing: string; start: Date; end: Date; status: CalendarState; amount: number; payout: string };

const statusStyle: Record<CalendarState, string> = {
  available: "bg-emerald-100 text-emerald-800",
  blocked: "bg-slate-200 text-slate-800",
  pending_payment: "bg-amber-100 text-amber-900",
  confirmed: "bg-sky-100 text-sky-900",
  cancelled: "bg-rose-100 text-rose-900",
  checkout_pending_review: "bg-violet-100 text-violet-900",
  dispute_hold: "bg-red-100 text-red-900",
};

const events: HostEvent[] = [
  { id: "e1", guest: "Nina R.", listing: "Cozy 1BR Condo", start: new Date(), end: addDays(new Date(), 2), status: "pending_payment", amount: 5200, payout: "Pending release" },
  { id: "e2", guest: "Jules K.", listing: "Beach Hut", start: addDays(new Date(), 3), end: addDays(new Date(), 6), status: "confirmed", amount: 9800, payout: "Scheduled May 30" },
  { id: "e3", guest: "Blocked", listing: "Maintenance", start: addDays(new Date(), 7), end: addDays(new Date(), 8), status: "blocked", amount: 0, payout: "N/A" },
  { id: "e4", guest: "Lena B.", listing: "City Studio", start: addDays(new Date(), 9), end: addDays(new Date(), 11), status: "checkout_pending_review", amount: 6200, payout: "Awaiting review" },
  { id: "e5", guest: "Case O.", listing: "City Studio", start: addDays(new Date(), 13), end: addDays(new Date(), 15), status: "dispute_hold", amount: 4600, payout: "On hold" },
  { id: "e6", guest: "Cancelled", listing: "Loft Stay", start: addDays(new Date(), 16), end: addDays(new Date(), 17), status: "cancelled", amount: 0, payout: "N/A" },
  { id: "e7", guest: "Open dates", listing: "All listings", start: addDays(new Date(), 18), end: addDays(new Date(), 20), status: "available", amount: 0, payout: "Bookable" },
];

export function HostDashboard() {
  const [selected, setSelected] = useState<HostEvent | null>(events[0]);
  const payoutCount = useMemo(() => events.filter((e) => e.status === "confirmed").length, []);

  return (
    <div className="space-y-6">
      <Card className="p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-muted-foreground">Verification status</p><p className="font-semibold">Identity verified · Listing quality review in progress</p></div><Badge>Step 2 of 3</Badge></div></Card>
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Listings</p><p className="text-2xl font-semibold">3 active</p><Button size="sm" variant="outline" className="mt-3">Add listing photos</Button></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Availability</p><p className="text-2xl font-semibold">12 open nights</p><Button size="sm" variant="outline" className="mt-3">Edit availability</Button></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Payouts</p><p className="text-2xl font-semibold">{payoutCount} scheduled</p><Button size="sm" variant="outline" className="mt-3">View payout status</Button></Card>
      </div>
      <Card className="p-5 space-y-4">
        <h3 className="font-semibold">Booking calendar</h3>
        <div className="flex flex-wrap gap-2 text-xs">{Object.entries(statusStyle).map(([k,v]) => <span key={k} className={`px-2 py-1 rounded-full ${v}`}>{k.replaceAll("_", " ")}</span>)}</div>
        <div className="grid gap-2 md:grid-cols-2">
          {events.map((event) => (
            <button key={event.id} onClick={() => setSelected(event)} className={`text-left border rounded-lg p-3 hover:border-primary ${selected?.id===event.id?"border-primary":"border-border"}`}>
              <p className="font-medium">{event.listing}</p>
              <p className="text-xs text-muted-foreground">{format(event.start, "MMM d")} → {format(event.end, "MMM d")}</p>
              <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${statusStyle[event.status]}`}>{event.status.replaceAll("_", " ")}</span>
            </button>
          ))}
        </div>
        {selected && (
          <Card className="p-4 bg-secondary/40" data-testid="booking-details">
            <p className="font-medium">Booking details</p>
            <p className="text-sm">Guest: {selected.guest}</p>
            <p className="text-sm">Stay: {format(selected.start, "PPP")} - {format(selected.end, "PPP")}</p>
            <p className="text-sm">Amount: ₱{selected.amount.toLocaleString()}</p>
            <p className="text-sm">Payout: {selected.payout}</p>
          </Card>
        )}
      </Card>
      <Card className="p-5 flex flex-wrap justify-between gap-3"><div><p className="font-medium">Need help with onboarding?</p><p className="text-sm text-muted-foreground">Support can verify docs and unblock payouts.</p></div><Button variant="secondary">Open host support</Button></Card>
    </div>
  );
}
