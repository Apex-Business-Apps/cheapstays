import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Star, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { GuestRatingBadge } from "@/components/GuestRatingBadge";
import { cn } from "@/lib/utils";

type Booking = {
  id: string;
  listing_id: string;
  guest_id: string;
  check_in: string;
  check_out: string;
  nights: number;
  guests: number;
  total_php: number;
  status: string;
  guest_message: string | null;
  created_at: string;
  listings: { title: string } | null;
  hasReview: boolean;
};

type RateState = { bookingId: string; guestId: string; listingId: string } | null;

function Stars({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-5 w-5 cursor-pointer transition-colors",
            (hover || rating) >= n ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
          )}
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
        />
      ))}
    </div>
  );
}

export function HostBookings({ hostId }: { hostId: string }) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateState, setRateState] = useState<RateState>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: bData } = await supabase
        .from("bookings")
        .select("id,listing_id,guest_id,check_in,check_out,nights,guests,total_php,status,guest_message,created_at,listings(title)")
        .eq("host_id", hostId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!bData) { setLoading(false); return; }

      // Find which bookings already have a host review
      const { data: reviewed } = await supabase
        .from("reviews")
        .select("booking_id")
        .eq("reviewer_id", hostId)
        .eq("reviewer_role", "host");

      const reviewedSet = new Set((reviewed ?? []).map((r) => r.booking_id));

      setBookings(
        bData.map((b) => ({
          ...b,
          listings: Array.isArray(b.listings) ? b.listings[0] ?? null : b.listings,
          hasReview: reviewedSet.has(b.id),
        })) as Booking[]
      );
      setLoading(false);
    }
    load();
  }, [hostId]);

  // Host actions go through backend edge functions — direct UPDATEs to
  // bookings.status are blocked by the bookings_guard_critical_columns trigger.
  async function updateStatus(bookingId: string, newStatus: "confirmed" | "cancelled") {
    setUpdating(bookingId);
    try {
      if (newStatus === "confirmed") {
        const { data, error } = await supabase.functions.invoke("approve-long-term-request", {
          body: { booking_id: bookingId },
        });
        if (error || data?.error) throw new Error(data?.message ?? data?.error ?? error?.message ?? "Approve failed");
        toast({ title: "Booking confirmed" });
      } else {
        const { data, error } = await supabase.functions.invoke("cancel-booking-host", {
          body: { booking_id: bookingId, reason: "Host declined this booking" },
        });
        if (error || data?.error) throw new Error(data?.message ?? data?.error ?? error?.message ?? "Cancel failed");
        toast({ title: "Booking declined" });
      }
      setBookings((prev) =>
        prev.map((b) => (b.id === bookingId ? { ...b, status: newStatus } : b))
      );
    } catch (err) {
      let msg = (err as Error).message;
      try {
        const body = await (err as { context?: Response }).context?.json();
        if (body?.error) msg = body.error;
      } catch { /* ignore */ }
      toast({ title: "Update failed", description: msg, variant: "destructive" });
    } finally {
      setUpdating(null);
    }
  }

  async function submitGuestReview() {
    if (!rateState || rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        listing_id: rateState.listingId,
        booking_id: rateState.bookingId,
        reviewer_id: hostId,
        host_id: hostId,
        reviewee_id: rateState.guestId,
        reviewer_role: "host",
        rating,
        body: body.trim(),
        is_public: true,
      });
      if (error) throw error;
      toast({ title: "Guest review posted" });
      setBookings((prev) =>
        prev.map((b) => (b.id === rateState.bookingId ? { ...b, hasReview: true } : b))
      );
      setRateState(null);
      setRating(0);
      setBody("");
    } catch (err) {
      toast({ title: "Failed to post review", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (!bookings.length) return <p className="text-center py-12 text-muted-foreground">No bookings yet.</p>;

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    confirmed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };

  return (
    <div className="space-y-4">
      {rateState && (
        <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3 mb-6">
          <p className="font-medium text-sm">Rate your guest</p>
          <Stars rating={rating} onChange={setRating} />
          <Textarea
            rows={3}
            placeholder="Describe this guest — were they respectful, communicative, left the place clean? (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={rating === 0 || submitting} onClick={submitGuestReview}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post review"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setRateState(null); setRating(0); setBody(""); }}>Cancel</Button>
          </div>
        </div>
      )}

      {bookings.map((b) => (
        <div key={b.id} className="rounded-xl border border-border/60 bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{b.listings?.title ?? "Listing"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {format(parseISO(b.check_in), "MMM d")} – {format(parseISO(b.check_out), "MMM d, yyyy")}
                &nbsp;· {b.nights} {b.nights === 1 ? "night" : "nights"} · {b.guests} {b.guests === 1 ? "guest" : "guests"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-semibold text-sm">₱{b.total_php.toLocaleString()}</p>
              <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", statusColor[b.status] ?? "bg-secondary text-secondary-foreground")}>
                {b.status}
              </span>
            </div>
          </div>

          {/* Guest rating */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Guest rating:</span>
            <GuestRatingBadge userId={b.guest_id} />
          </div>

          {b.guest_message && (
            <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">{b.guest_message}</p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {b.status === "pending" && (
              <>
                <Button size="sm" className="gap-1.5" disabled={updating === b.id} onClick={() => updateStatus(b.id, "confirmed")}>
                  {updating === b.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Confirm
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" disabled={updating === b.id} onClick={() => updateStatus(b.id, "cancelled")}>
                  <XCircle className="h-3 w-3" /> Decline
                </Button>
              </>
            )}
            {b.status === "confirmed" && !b.hasReview && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setRateState({ bookingId: b.id, guestId: b.guest_id, listingId: b.listing_id })}
              >
                <Star className="h-3 w-3" /> Rate guest
              </Button>
            )}
            {b.status === "confirmed" && b.hasReview && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-primary" /> Guest reviewed
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
