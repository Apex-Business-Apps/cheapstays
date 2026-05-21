import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Review = {
  id: string;
  rating: number;
  body: string;
  created_at: string;
  reviewer_id: string;
};

type Props = { listingId: string; hostId: string };

function Stars({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-4 w-4 transition-colors",
            (interactive ? (hover || rating) : rating) >= n
              ? "fill-yellow-400 text-yellow-400"
              : "text-muted-foreground/40",
            interactive && "cursor-pointer"
          )}
          onClick={() => interactive && onChange?.(n)}
          onMouseEnter={() => interactive && setHover(n)}
          onMouseLeave={() => interactive && setHover(0)}
        />
      ))}
    </div>
  );
}

export function ReviewList({ listingId, hostId }: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [eligibleBookingId, setEligibleBookingId] = useState<string | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    supabase
      .from("reviews")
      .select("id,rating,body,created_at,reviewer_id")
      .eq("listing_id", listingId)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReviews((data ?? []) as Review[]);
        setLoading(false);
      });
  }, [listingId]);

  useEffect(() => {
    if (!user) return;
    // Check for a confirmed booking the user can review
    supabase
      .from("bookings")
      .select("id")
      .eq("listing_id", listingId)
      .eq("guest_id", user.id)
      .eq("status", "confirmed")
      .limit(1)
      .then(({ data }) => {
        if (!data?.length) return;
        const bid = data[0].id;
        setEligibleBookingId(bid);
        // Check if already reviewed
        supabase
          .from("reviews")
          .select("id")
          .eq("booking_id", bid)
          .eq("reviewer_id", user.id)
          .limit(1)
          .then(({ data: rd }) => setAlreadyReviewed((rd ?? []).length > 0));
      });
  }, [user, listingId]);

  async function submitReview() {
    if (!user || !eligibleBookingId || rating === 0) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("reviews").insert({
        listing_id: listingId,
        booking_id: eligibleBookingId,
        reviewer_id: user.id,
        host_id: hostId,
        rating,
        body: body.trim(),
        is_public: true,
      });
      if (error) throw error;
      toast({ title: "Review posted!" });
      setAlreadyReviewed(true);
      setShowForm(false);
      // Optimistically add to list
      setReviews((prev) => [
        {
          id: crypto.randomUUID(),
          rating,
          body: body.trim(),
          created_at: new Date().toISOString(),
          reviewer_id: user.id,
        },
        ...prev,
      ]);
    } catch (err) {
      toast({ title: "Failed to post review", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const avg = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium">Reviews</h2>
          {avg !== null && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              {avg.toFixed(1)} ({reviews.length})
            </span>
          )}
        </div>
        {eligibleBookingId && !alreadyReviewed && (
          <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
            Write a review
          </Button>
        )}
      </div>

      {/* Write review form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-border/60 p-4 space-y-3">
          <p className="text-sm font-medium">Your review</p>
          <Stars rating={rating} interactive onChange={setRating} />
          <Textarea
            placeholder="Tell guests what you loved about this place…"
            rows={3}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" disabled={rating === 0 || submitting} onClick={submitReview}>
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Post review"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Review list */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-muted-foreground">No reviews yet. Be the first to stay here!</p>
      ) : (
        <div className="space-y-5">
          {reviews.map((r) => (
            <div key={r.id} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Stars rating={r.rating} />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(r.created_at), "MMM yyyy")}
                </span>
              </div>
              {r.body && <p className="text-sm text-muted-foreground leading-relaxed">{r.body}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
