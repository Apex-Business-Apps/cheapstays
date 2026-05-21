import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { aiSearchSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { ExternalLink, Loader2, Sparkles, Star } from "lucide-react";
import { Seo } from "@/components/Seo";

type Result = {
  id: string;
  title: string;
  city: string;
  nightly_php: number;
  why_its_a_deal: string;
  score: number;
  bedrooms: number;
  max_guests: number;
  amenities: string[];
  avg_rating: number | null;
  is_owner_direct: boolean;
};

type PartnerResult = {
  id: string;
  title: string;
  city: string;
  star_rating: number;
  review_score: number;
  review_count: number;
  nightly_php: number;
  image_url: string;
  booking_url: string;
  source: "agoda";
};

type BookingState = {
  listing: Result;
  checkIn: string;
  checkOut: string;
  guests: number;
  message: string;
  submitting: boolean;
  confirmed: boolean;
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function nightCount(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 0;
  const diff = new Date(checkOut).getTime() - new Date(checkIn).getTime();
  return Math.max(0, Math.round(diff / 86400000));
}

function SkeletonCard() {
  return (
    <Card className="p-5 space-y-3">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
      <Skeleton className="h-9 w-full mt-2" />
    </Card>
  );
}

function PartnerSkeletonCard() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="h-40 w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-8 w-full mt-2" />
      </div>
    </Card>
  );
}

export default function Search() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [partnerResults, setPartnerResults] = useState<PartnerResult[]>([]);
  const [partnerLoading, setPartnerLoading] = useState(false);
  const [booking, setBooking] = useState<BookingState | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const parsed = aiSearchSchema.safeParse({ query });
    if (!parsed.success) {
      toast({ title: "Refine your search", description: "Try at least a few words." });
      return;
    }
    setLoading(true);
    setPartnerLoading(true);
    setResults([]);
    setSummary("");
    setPartnerResults([]);

    const aiSearchPromise = supabase.functions
      .invoke("ai-search", { body: parsed.data })
      .then(({ data, error }) => {
        if (error) throw error;
        setResults(data?.results ?? []);
        setSummary(data?.summary ?? "");
      })
      .catch((err) => {
        toast({ title: "Search failed", description: (err as Error).message, variant: "destructive" });
      })
      .finally(() => setLoading(false));

    const agodaPromise = supabase.functions
      .invoke("agoda-search", { body: { destination: query } })
      .then(({ data }) => {
        setPartnerResults(data?.results ?? []);
      })
      .catch(() => {
        // Silently ignore partner errors — native results are the primary product
      })
      .finally(() => setPartnerLoading(false));

    await Promise.all([aiSearchPromise, agodaPromise]);
  }

  function openBooking(listing: Result) {
    const ci = today();
    setBooking({
      listing,
      checkIn: ci,
      checkOut: addDays(ci, 1),
      guests: 1,
      message: "",
      submitting: false,
      confirmed: false,
    });
  }

  async function confirmBooking(e: React.FormEvent) {
    e.preventDefault();
    if (!booking) return;
    const nights = nightCount(booking.checkIn, booking.checkOut);
    if (nights < 1) {
      toast({ title: "Check-out must be after check-in", variant: "destructive" });
      return;
    }
    setBooking((prev) => prev && { ...prev, submitting: true });
    try {
      const { error } = await supabase.functions.invoke("book-listing", {
        body: {
          listing_id: booking.listing.id,
          check_in: booking.checkIn,
          check_out: booking.checkOut,
          guests: booking.guests,
          guest_message: booking.message,
        },
      });
      if (error) throw error;
      toast({ title: "Booking confirmed!", description: `${booking.listing.title} is reserved for you.` });
      setBooking((prev) => prev && { ...prev, confirmed: true, submitting: false });
    } catch (err) {
      toast({ title: "Booking failed", description: (err as Error).message, variant: "destructive" });
      setBooking((prev) => prev && { ...prev, submitting: false });
    }
  }

  const nights = booking ? nightCount(booking.checkIn, booking.checkOut) : 0;
  const total = booking ? nights * booking.listing.nightly_php : 0;

  return (
    <div>
      <Seo title="CheapStays Search" description="Search owner-direct Philippine rentals with AI-powered filters." path="/search" />
      <div className="container py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">AI deal search</h1>
          <p className="mt-2 text-muted-foreground">
            Describe your trip. Our AI ranks listings by real value, not booking-site noise.
          </p>
        </div>

        <form onSubmit={run} className="mt-6 flex gap-2 max-w-2xl">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Beach villa in Siargao under ₱3000, fast wifi..."
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" /> Search
              </>
            )}
          </Button>
        </form>

        {summary && (
          <p className="mt-6 text-sm text-muted-foreground max-w-2xl border-l-2 border-accent pl-3">
            {summary}
          </p>
        )}

        <div className="mt-8 grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {loading && (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          )}

          {!loading &&
            results.map((r) => {
              const visibleAmenities = r.amenities.slice(0, 4);
              const extraCount = r.amenities.length - visibleAmenities.length;
              return (
                <Card key={r.id} className="p-5 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base leading-tight">{r.title}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">{r.city}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {r.avg_rating !== null ? (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          {r.avg_rating.toFixed(1)}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">New</Badge>
                      )}
                      {r.is_owner_direct && (
                        <Badge className="text-xs bg-green-100 text-green-800 border-green-200">
                          Owner direct
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="text-xl font-bold text-primary">
                    ₱{r.nightly_php.toLocaleString()}
                    <span className="text-sm font-normal text-muted-foreground">/night</span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {r.bedrooms} BR &middot; Up to {r.max_guests} guests
                  </p>

                  {r.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {visibleAmenities.map((a) => (
                        <Badge key={a} variant="outline" className="text-xs capitalize">
                          {a.replace(/_/g, " ")}
                        </Badge>
                      ))}
                      {extraCount > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{extraCount} more
                        </Badge>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-muted-foreground">{r.why_its_a_deal}</p>

                  <div className="text-xs text-muted-foreground">Deal score: {r.score}/100</div>

                  <Button className="w-full mt-auto" onClick={() => openBooking(r)}>
                    Book now
                  </Button>
                </Card>
              );
            })}
        </div>

        {!loading && results.length === 0 && !partnerLoading && partnerResults.length === 0 && query && (
          <p className="mt-12 text-center text-muted-foreground">
            No results yet. Try a different search.
          </p>
        )}

        {/* Partner listings from Agoda */}
        {(partnerLoading || partnerResults.length > 0) && (
          <>
            <Separator className="mt-12 mb-8" />
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-xl font-semibold">Partner listings</h2>
              <Badge variant="outline" className="text-xs">Via Agoda</Badge>
              <span className="text-xs text-muted-foreground">Prices from Agoda affiliate network</span>
            </div>
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {partnerLoading && (
                <>
                  <PartnerSkeletonCard />
                  <PartnerSkeletonCard />
                  <PartnerSkeletonCard />
                </>
              )}
              {!partnerLoading &&
                partnerResults.map((p) => (
                  <Card key={p.id} className="overflow-hidden flex flex-col">
                    {p.image_url ? (
                      <img
                        src={p.image_url}
                        alt={p.title}
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="h-40 w-full bg-muted flex items-center justify-center text-muted-foreground text-sm">
                        No image
                      </div>
                    )}
                    <div className="p-4 flex flex-col gap-2 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-tight line-clamp-2">{p.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">{p.city}</p>
                        </div>
                        <Badge variant="secondary" className="shrink-0 flex items-center gap-1 text-xs">
                          <Star className="h-3 w-3 fill-current" />
                          {p.review_score > 0 ? p.review_score.toFixed(1) : "—"}
                        </Badge>
                      </div>

                      {p.star_rating > 0 && (
                        <div className="flex gap-0.5">
                          {Array.from({ length: p.star_rating }).map((_, i) => (
                            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          ))}
                        </div>
                      )}

                      <div className="text-lg font-bold text-primary mt-auto">
                        ₱{p.nightly_php.toLocaleString()}
                        <span className="text-xs font-normal text-muted-foreground">/night</span>
                      </div>

                      {p.review_count > 0 && (
                        <p className="text-xs text-muted-foreground">{p.review_count.toLocaleString()} reviews</p>
                      )}

                      <a
                        href={p.booking_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-auto"
                      >
                        <Button className="w-full" variant="outline" size="sm">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Book on Agoda
                        </Button>
                      </a>
                    </div>
                  </Card>
                ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Partner listings are provided by Agoda. CheapStays may earn a commission on bookings.
            </p>
          </>
        )}
      </div>

      {/* Booking dialog */}
      <Dialog open={!!booking} onOpenChange={(open) => !open && setBooking(null)}>
        <DialogContent className="max-w-md">
          {booking && (
            <>
              <DialogHeader>
                <DialogTitle>Book {booking.listing.title}</DialogTitle>
                <DialogDescription>
                  {booking.listing.city} &middot; ₱{booking.listing.nightly_php.toLocaleString()}/night
                </DialogDescription>
              </DialogHeader>

              {!user ? (
                <div className="py-4 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">You need to be signed in to book.</p>
                  <Button asChild>
                    <Link to="/auth">Sign in to book</Link>
                  </Button>
                </div>
              ) : booking.confirmed ? (
                <div className="py-6 text-center space-y-2">
                  <p className="text-lg font-semibold text-green-700">Booking confirmed!</p>
                  <p className="text-sm text-muted-foreground">
                    The host will contact you shortly. Check your email for details.
                  </p>
                  <Badge variant="secondary" className="mt-2">Status: Pending host approval</Badge>
                </div>
              ) : (
                <form onSubmit={confirmBooking} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="check-in">Check-in</Label>
                      <Input
                        id="check-in"
                        type="date"
                        min={today()}
                        value={booking.checkIn}
                        onChange={(e) =>
                          setBooking((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  checkIn: e.target.value,
                                  checkOut:
                                    prev.checkOut <= e.target.value
                                      ? addDays(e.target.value, 1)
                                      : prev.checkOut,
                                }
                              : prev
                          )
                        }
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="check-out">Check-out</Label>
                      <Input
                        id="check-out"
                        type="date"
                        min={addDays(booking.checkIn, 1)}
                        value={booking.checkOut}
                        onChange={(e) =>
                          setBooking((prev) => prev && { ...prev, checkOut: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="guests">Guests</Label>
                    <Input
                      id="guests"
                      type="number"
                      min={1}
                      max={booking.listing.max_guests}
                      value={booking.guests}
                      onChange={(e) =>
                        setBooking((prev) => prev && { ...prev, guests: Number(e.target.value) })
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">Max {booking.listing.max_guests} guests</p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="msg">Message to host (optional)</Label>
                    <Textarea
                      id="msg"
                      rows={3}
                      placeholder="Tell the host about your trip..."
                      value={booking.message}
                      onChange={(e) =>
                        setBooking((prev) => prev && { ...prev, message: e.target.value })
                      }
                    />
                  </div>

                  {nights > 0 && (
                    <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>
                          ₱{booking.listing.nightly_php.toLocaleString()} x {nights} night{nights !== 1 ? "s" : ""}
                        </span>
                        <span>₱{(nights * booking.listing.nightly_php).toLocaleString()}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>₱{total.toLocaleString()}</span>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setBooking(null)}
                      disabled={booking.submitting}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={booking.submitting || nights < 1}>
                      {booking.submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-1" />
                      ) : null}
                      Confirm booking
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
