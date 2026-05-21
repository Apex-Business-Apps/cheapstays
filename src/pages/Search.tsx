import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2, Sparkles, Wifi, Zap, Users, BedDouble, Star } from "lucide-react";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";

type Listing = {
  id: string;
  slug: string | null;
  title: string;
  city: string;
  province: string;
  type: string;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  nightly_php: number;
  min_nights: number;
  amenities: string[];
  is_owner_direct: boolean;
  instant_book: boolean;
  avg_rating: number | null;
  review_count: number;
  why_its_a_deal: string;
  score: number;
};

const TYPE_LABELS: Record<string, string> = {
  entire_place: "Entire place",
  private_room: "Private room",
  shared_room: "Shared room",
  villa: "Villa",
  glamping: "Glamping",
};

const AMENITY_ICONS: Record<string, string> = {
  wifi: "WiFi",
  aircon: "A/C",
  kitchen: "Kitchen",
  pool: "Pool",
  private_pool: "Pool",
  parking: "Parking",
  breakfast_included: "Breakfast",
  instant_book: "Instant",
  pet_friendly: "Pets OK",
  beach_access: "Beach",
  work_desk: "Desk",
};

function ListingCard({ listing }: { listing: Listing }) {
  const href = `/listing/${listing.id}`;
  const displayAmenities = (listing.amenities ?? [])
    .filter((a) => AMENITY_ICONS[a])
    .slice(0, 4);

  return (
    <Link
      to={href}
      className="group block rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      {/* Placeholder image area */}
      <div className="h-44 bg-gradient-to-br from-secondary/60 to-accent/10 flex items-center justify-center relative">
        <span className="text-4xl opacity-20 select-none">
          {listing.type === "villa" ? "🏡" : listing.type === "glamping" ? "⛺" : "🏠"}
        </span>
        {listing.instant_book && (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] gap-1">
            <Zap className="h-3 w-3" /> Instant book
          </Badge>
        )}
        {listing.is_owner_direct && (
          <Badge variant="secondary" className="absolute top-3 right-3 text-[10px]">
            Owner direct
          </Badge>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              {listing.title}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {listing.city}, {listing.province}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm">₱{listing.nightly_php.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">/ night</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="h-3 w-3" /> {listing.bedrooms}BR
          </span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" /> up to {listing.max_guests}
          </span>
          {listing.min_nights > 1 && (
            <span>min {listing.min_nights} nights</span>
          )}
          {listing.avg_rating && (
            <span className="flex items-center gap-0.5 ml-auto">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {listing.avg_rating.toFixed(1)}
            </span>
          )}
        </div>

        {displayAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {displayAmenities.map((a) => (
              <span key={a} className="text-[10px] bg-secondary/60 rounded-full px-2 py-0.5">
                {AMENITY_ICONS[a]}
              </span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 line-clamp-2">
          {listing.why_its_a_deal}
        </p>

        <div className="flex items-center justify-between pt-1">
          <Badge variant="outline" className="text-[10px]">
            {TYPE_LABELS[listing.type] ?? listing.type}
          </Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Deal score {listing.score}/100</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Search() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Listing[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const parsed = aiSearchSchema.safeParse({ query });
    if (!parsed.success) {
      toast({ title: "Refine your search", description: "Try at least a few words." });
      return;
    }
    setLoading(true);
    setSearched(false);
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
      setResults(data?.results ?? []);
      setSummary(data?.summary ?? "");
      setSearched(true);
    } catch (err) {
      toast({ title: "Search failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const nights = booking ? nightCount(booking.checkIn, booking.checkOut) : 0;
  const total = booking ? nights * booking.listing.nightly_php : 0;

  return (
    <div>
      <Seo
        title="Find Stays · CheapStays"
        description="Search owner-direct Philippine rentals with AI-powered deal ranking."
        path="/search"
      />
      <div className="container py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Find your stay</h1>
          <p className="mt-2 text-muted-foreground">
            Describe your trip — city, budget, vibe. Our AI ranks real listings by actual value.
          </p>
        </div>

        <form onSubmit={run} className="mt-6 flex gap-2 max-w-2xl">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="2 nights in Quezon City, budget ₱2,000, need WiFi…"
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <><Sparkles className="h-4 w-4 mr-1" /> Search</>}
          </Button>
        </form>

        {summary && (
          <p className="mt-6 text-sm text-muted-foreground max-w-2xl border-l-2 border-primary/40 pl-3">
            {summary}
          </p>
        )}

        {searched && results.length === 0 && (
          <div className="mt-12 text-center text-muted-foreground">
            <p className="text-lg">No matches found.</p>
            <p className="text-sm mt-1">Try a different city, adjust your budget, or broaden your description.</p>
          </div>
        )}

        {results.length > 0 && (
          <div className={cn("mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
            {results.map((r) => (
              <ListingCard key={r.id} listing={r} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
