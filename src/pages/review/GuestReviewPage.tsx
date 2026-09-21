import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CheckCircle2, Clock, Home, Loader2, MapPin, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import type { FunctionsHttpError } from "@supabase/supabase-js";
import { Seo } from "@/components/Seo";
import { Stars } from "@/components/ReviewList";
import { toast } from "@/hooks/use-toast";

type Status = "loading" | "ready" | "already_submitted" | "expired" | "not_found" | "error";

type LookupResponse = {
  status: "ready" | "already_submitted" | "expired" | "not_found";
  listing: {
    id: string;
    title: string;
    city: string | null;
    province: string | null;
    cover_photo_url: string | null;
    host_name: string | null;
  } | null;
  stay: {
    check_in: string;
    check_out: string;
    nights: number;
    guests: number;
    guest_name: string | null;
  } | null;
  expires_at: string;
  submitted_at: string | null;
};

async function unwrapError(err: unknown): Promise<string> {
  const base = (err as Error).message;
  try {
    const body = await (err as FunctionsHttpError).context?.json();
    if (body?.error) return typeof body.error === "string" ? body.error : JSON.stringify(body.error);
  } catch { /* ignore */ }
  return base;
}

export default function GuestReviewPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [status, setStatus] = useState<Status>("loading");
  const [data, setData] = useState<LookupResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setStatus("loading");
      try {
        const { data: res, error } = await supabase.functions.invoke<LookupResponse>(
          "guest-review-lookup",
          { body: { token } },
        );
        if (error) throw error;
        if (cancelled) return;
        if (!res) { setStatus("error"); setErrorMsg("Empty response"); return; }
        setData(res);
        setStatus(res.status);
      } catch (err) {
        if (cancelled) return;
        const msg = await unwrapError(err);
        setErrorMsg(msg);
        setStatus("error");
      }
    }
    if (token) load();
    return () => { cancelled = true; };
  }, [token]);

  async function submit() {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("guest-review-submit", {
        body: { token, rating, body: body.trim() },
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      const msg = await unwrapError(err);
      toast({ title: "Couldn't submit review", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-muted/30">
      <Seo title="Leave a review · CheapStays" description="Rate your recent stay." path={`/review/${token}`} />
      <div className="mx-auto max-w-xl px-4 py-8 sm:py-12">
        {status === "loading" && (
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {status === "not_found" && <StateCard
          icon={<ShieldAlert className="h-6 w-6 text-amber-500" />}
          title="Link not found"
          description="This review link isn't valid. Double-check the URL in the email your host sent you."
        />}

        {status === "expired" && <StateCard
          icon={<Clock className="h-6 w-6 text-amber-500" />}
          title="Link expired"
          description="This review link has expired. Ask your host to send a new one if you'd still like to leave feedback."
        />}

        {status === "already_submitted" && <StateCard
          icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
          title="Review already submitted"
          description="Thanks — we've already recorded your review for this stay."
        />}

        {status === "error" && <StateCard
          icon={<ShieldAlert className="h-6 w-6 text-red-500" />}
          title="Something went wrong"
          description={errorMsg ?? "Please refresh the page and try again."}
        />}

        {status === "ready" && data && (submitted
          ? <StateCard
              icon={<CheckCircle2 className="h-6 w-6 text-emerald-500" />}
              title="Thanks for your review!"
              description="Your feedback is now live and helps future guests pick the right stay."
              cta={<Link to="/"><Button variant="outline" size="sm" className="gap-1.5"><Home className="h-3.5 w-3.5" /> Back to CheapStays</Button></Link>}
            />
          : <ReviewForm
              data={data}
              rating={rating}
              body={body}
              submitting={submitting}
              onRating={setRating}
              onBody={setBody}
              onSubmit={submit}
            />
        )}
      </div>
    </div>
  );
}

function StateCard({ icon, title, description, cta }: {
  icon: React.ReactNode; title: string; description: string; cta?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-background p-8 sm:p-10 flex flex-col items-center text-center gap-4">
      <div className="rounded-full bg-muted p-3">{icon}</div>
      <div className="space-y-1.5">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      </div>
      {cta}
    </div>
  );
}

function ReviewForm({
  data, rating, body, submitting, onRating, onBody, onSubmit,
}: {
  data: LookupResponse;
  rating: number;
  body: string;
  submitting: boolean;
  onRating: (r: number) => void;
  onBody: (v: string) => void;
  onSubmit: () => void;
}) {
  const { listing, stay } = data;
  const location = [listing?.city, listing?.province].filter(Boolean).join(", ");
  return (
    <div className="rounded-2xl border bg-background overflow-hidden">
      {/* Hero */}
      <div className="relative h-40 sm:h-52 bg-muted">
        {listing?.cover_photo_url ? (
          <img
            src={listing.cover_photo_url}
            alt={listing.title ?? ""}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <Home className="h-8 w-8" />
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
          <p className="text-[11px] uppercase tracking-wider text-white/80">Leave a review</p>
          <h1 className="text-lg font-semibold text-white truncate">{listing?.title ?? "Your stay"}</h1>
          {location && (
            <p className="text-xs text-white/85 flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" /> {location}
            </p>
          )}
        </div>
      </div>

      {/* Stay metadata */}
      <div className="border-b bg-muted/30 px-5 py-3 grid grid-cols-3 gap-3 text-center text-xs">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-in</p>
          <p className="font-medium mt-0.5">{stay ? format(parseISO(stay.check_in), "MMM d, yyyy") : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Check-out</p>
          <p className="font-medium mt-0.5">{stay ? format(parseISO(stay.check_out), "MMM d, yyyy") : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Nights</p>
          <p className="font-medium mt-0.5">{stay?.nights ?? "—"}</p>
        </div>
      </div>

      {/* Form */}
      <div className="p-5 sm:p-6 space-y-5">
        {listing?.host_name && (
          <p className="text-sm text-muted-foreground">
            How was your stay with <span className="font-medium text-foreground">{listing.host_name}</span>?
          </p>
        )}

        <div className="space-y-2">
          <p className="text-sm font-medium">Your rating</p>
          <div className="flex items-center gap-3">
            <Stars rating={rating} interactive onChange={onRating} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {rating > 0 ? `${rating} / 5` : "Tap a star"}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="review-body" className="text-sm font-medium">Comment (optional)</label>
          <Textarea
            id="review-body"
            rows={5}
            placeholder="Was the space accurate, clean, and easy to check into? What stood out?"
            value={body}
            onChange={(e) => onBody(e.target.value)}
            className="text-sm resize-none"
            maxLength={2000}
          />
          <p className="text-[11px] text-muted-foreground text-right tabular-nums">{body.length}/2000</p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Button
            className="flex-1"
            disabled={rating === 0 || submitting}
            onClick={onSubmit}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit review"}
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground text-center">
          Your review will be posted publicly on the listing page.
        </p>
      </div>
    </div>
  );
}
