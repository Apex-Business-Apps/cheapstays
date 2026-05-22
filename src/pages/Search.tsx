import { useState, useMemo, useEffect, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { aiSearchSchema } from "@/lib/schemas";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Zap, Users, BedDouble, Star, SlidersHorizontal, X, Lock } from "lucide-react";
import { Seo } from "@/components/Seo";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { isMember } from "@/lib/rbac";

type Listing = {
  id: string;
  slug: string | null;
  host_id: string;
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
  images: string[];
  is_owner_direct: boolean;
  instant_book: boolean;
  avg_rating: number | null;
  review_count: number;
  why_its_a_deal: string;
  score: number;
};

type SortKey = "score" | "price_asc" | "price_desc" | "rating" | "newest";

type Filters = {
  maxPrice: number;
  minBedrooms: number;
  minGuests: number;
  types: string[];
  amenities: string[];
  instantBook: boolean;
  ownerDirect: boolean;
};

const DEFAULT_FILTERS: Filters = {
  maxPrice: 20000,
  minBedrooms: 0,
  minGuests: 1,
  types: [],
  amenities: [],
  instantBook: false,
  ownerDirect: false,
};

const TYPE_LABELS: Record<string, string> = {
  entire_place: "Entire place",
  private_room: "Private room",
  shared_room: "Shared room",
  villa: "Villa",
  glamping: "Glamping",
};

const AMENITY_ICONS: Record<string, string> = {
  wifi: "WiFi", aircon: "A/C", kitchen: "Kitchen", pool: "Pool",
  private_pool: "Pool", parking: "Parking", breakfast_included: "Breakfast",
  pet_friendly: "Pets OK", beach_access: "Beach", work_desk: "Desk",
};

const FILTER_AMENITIES = [
  "wifi", "aircon", "pool", "private_pool", "kitchen",
  "parking", "breakfast_included", "beach_access", "pet_friendly", "work_desk",
];

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi", aircon: "Air conditioning", pool: "Pool", private_pool: "Private pool",
  kitchen: "Kitchen", parking: "Parking", breakfast_included: "Breakfast included",
  beach_access: "Beach access", pet_friendly: "Pet friendly", work_desk: "Work desk",
};

const DAILY_SEARCH_LIMIT = 5;

function todayKey() {
  return `cheapstays:ai_searches:${new Date().toISOString().slice(0, 10)}`;
}
function getDailySearchCount(): number {
  return parseInt(localStorage.getItem(todayKey()) ?? "0", 10);
}
function incrementDailySearchCount() {
  localStorage.setItem(todayKey(), String(getDailySearchCount() + 1));
}

function activeFilterCount(f: Filters): number {
  return (
    (f.maxPrice < DEFAULT_FILTERS.maxPrice ? 1 : 0) +
    (f.minBedrooms > 0 ? 1 : 0) +
    (f.minGuests > 1 ? 1 : 0) +
    f.types.length +
    f.amenities.length +
    (f.instantBook ? 1 : 0) +
    (f.ownerDirect ? 1 : 0)
  );
}

type GuestRating = { avg: number; count: number } | null;

function ListingCard({ listing, guestRating }: { listing: Listing; guestRating?: GuestRating }) {
  const heroImage = listing.images?.[0];
  const displayAmenities = (listing.amenities ?? []).filter((a) => AMENITY_ICONS[a]).slice(0, 4);

  return (
    <Link
      to={listing.slug ? `/listing/slug/${listing.slug}` : `/listing/${listing.id}`}
      className="group block rounded-2xl border border-border/60 bg-card hover:border-primary/40 hover:shadow-md transition-all duration-200 overflow-hidden"
    >
      <div className="h-44 bg-gradient-to-br from-secondary/60 to-accent/10 flex items-center justify-center relative overflow-hidden">
        {heroImage ? (
          <img src={heroImage} alt={listing.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" loading="lazy" />
        ) : (
          <span className="text-4xl opacity-20 select-none">
            {listing.type === "villa" ? "🏡" : listing.type === "glamping" ? "⛺" : "🏠"}
          </span>
        )}
        {listing.instant_book && (
          <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground text-[10px] gap-1">
            <Zap className="h-3 w-3" /> Instant book
          </Badge>
        )}
        {listing.is_owner_direct && (
          <Badge variant="secondary" className="absolute top-3 right-3 text-[10px]">Owner direct</Badge>
        )}
      </div>

      <div className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">{listing.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{listing.city}, {listing.province}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-semibold text-sm">₱{listing.nightly_php.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">/ night</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {listing.bedrooms}BR</span>
          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> up to {listing.max_guests}</span>
          {listing.min_nights > 1 && <span>min {listing.min_nights} nights</span>}
          {listing.avg_rating && (
            <span className="flex items-center gap-0.5 ml-auto">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              {listing.avg_rating.toFixed(1)}
            </span>
          )}
        </div>

        {guestRating && (
          <span className="inline-flex items-center gap-1 rounded-full border border-yellow-300/60 bg-yellow-50 dark:bg-yellow-950/30 px-2 py-0.5 text-[10px] font-medium text-yellow-700 dark:text-yellow-400">
            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />
            {guestRating.avg.toFixed(1)} guest · {guestRating.count} {guestRating.count === 1 ? "review" : "reviews"}
          </span>
        )}

        {displayAmenities.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {displayAmenities.map((a) => (
              <span key={a} className="text-[10px] bg-secondary/60 rounded-full px-2 py-0.5">{AMENITY_ICONS[a]}</span>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2 line-clamp-2">{listing.why_its_a_deal}</p>

        <div className="flex items-center justify-between pt-1">
          <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[listing.type] ?? listing.type}</Badge>
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            <span>Deal score {listing.score}/100</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <Skeleton className="h-44 w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs border transition-colors",
        active ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}

export default function Search() {
  const { user, roles } = useAuth();
  const memberUser = isMember(roles);
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initialQ);
  const [results, setResults] = useState<Listing[]>([]);
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [sort, setSort] = useState<SortKey>("score");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [browseListings, setBrowseListings] = useState<Listing[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [hostRatings, setHostRatings] = useState<Map<string, GuestRating>>(new Map());
  const [dailyCount, setDailyCount] = useState(() => getDailySearchCount());
  const autoSearched = useRef(false);

  const searchesRemaining = memberUser ? Infinity : Math.max(0, DAILY_SEARCH_LIMIT - dailyCount);
  const searchLimitReached = !memberUser && user != null && dailyCount >= DAILY_SEARCH_LIMIT;

  async function fetchHostRatings(listings: Listing[]) {
    const hostIds = [...new Set(listings.map((l) => l.host_id))];
    if (hostIds.length === 0) return;
    const { data } = await supabase
      .from("reviews")
      .select("reviewee_id, rating")
      .in("reviewee_id", hostIds)
      .eq("reviewer_role", "host")
      .eq("is_public", true);
    if (!data) return;
    const grouped = new Map<string, number[]>();
    for (const row of data) {
      if (!grouped.has(row.reviewee_id)) grouped.set(row.reviewee_id, []);
      grouped.get(row.reviewee_id)!.push(row.rating);
    }
    setHostRatings((prev) => {
      const next = new Map(prev);
      for (const id of hostIds) {
        const ratings = grouped.get(id);
        next.set(id, ratings?.length
          ? { avg: Math.round(ratings.reduce((s, r) => s + r, 0) / ratings.length * 10) / 10, count: ratings.length }
          : null
        );
      }
      return next;
    });
  }

  // Auto-run search when arriving with a ?q= param (e.g. from destination cards)
  useEffect(() => {
    if (initialQ && !autoSearched.current) {
      autoSearched.current = true;
      const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
      run(fakeEvent, initialQ);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    setBrowseLoading(true);
    (async () => {
      try {
        const { data } = await supabase
          .from("listings")
          .select("id, slug, host_id, title, city, province, type, bedrooms, bathrooms, max_guests, nightly_php, min_nights, amenities, images, is_owner_direct, instant_book, avg_rating, review_count")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(12);
        if (!cancelled) {
          const listings = (data ?? []).map((l) => ({ ...l, why_its_a_deal: "", score: 0 })) as Listing[];
          setBrowseListings(listings);
          fetchHostRatings(listings);
        }
      } catch {
        // silent — browse listings are non-critical
      } finally {
        if (!cancelled) setBrowseLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function run(e: React.FormEvent, overrideQuery?: string) {
    e.preventDefault();
    const q = overrideQuery ?? query;
    const parsed = aiSearchSchema.safeParse({ query: q });
    if (!parsed.success) {
      toast({ title: "Refine your search", description: "Try at least a few words." });
      return;
    }
    if (!memberUser && user != null && getDailySearchCount() >= DAILY_SEARCH_LIMIT) {
      toast({ title: "Daily limit reached", description: "Upgrade to Member for unlimited AI searches.", variant: "destructive" });
      setDailyCount(getDailySearchCount());
      return;
    }
    setLoading(true);
    setSearched(false);
    try {
      const { data, error } = await supabase.functions.invoke("ai-search", { body: { query: q } });
      if (error) throw error;
      const searchResults: Listing[] = data?.results ?? [];
      setResults(searchResults);
      setSummary(data?.summary ?? "");
      setSearched(true);
      fetchHostRatings(searchResults);
      if (!memberUser && user != null) {
        incrementDailySearchCount();
        setDailyCount(getDailySearchCount());
      }
    } catch (err) {
      toast({ title: "Search failed", description: (err as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function toggleType(t: string) {
    setFilters((f) => ({ ...f, types: f.types.includes(t) ? f.types.filter((x) => x !== t) : [...f.types, t] }));
  }
  function toggleAmenity(a: string) {
    setFilters((f) => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a] }));
  }
  function resetFilters() { setFilters(DEFAULT_FILTERS); }

  const filtered = useMemo(() => {
    let list = results.filter((r) => {
      if (r.nightly_php > filters.maxPrice) return false;
      if (r.bedrooms < filters.minBedrooms) return false;
      if (r.max_guests < filters.minGuests) return false;
      if (filters.types.length && !filters.types.includes(r.type)) return false;
      if (filters.amenities.length && !filters.amenities.every((a) => r.amenities?.includes(a))) return false;
      if (filters.instantBook && !r.instant_book) return false;
      if (filters.ownerDirect && !r.is_owner_direct) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "score") return b.score - a.score;
      if (sort === "price_asc") return a.nightly_php - b.nightly_php;
      if (sort === "price_desc") return b.nightly_php - a.nightly_php;
      if (sort === "rating") return (b.avg_rating ?? 0) - (a.avg_rating ?? 0);
      return 0;
    });

    return list;
  }, [results, filters, sort]);

  const numFilters = activeFilterCount(filters);

  return (
    <div>
      <Seo title="Find Stays · CheapStays" description="Search owner-direct Philippine rentals with AI-powered deal ranking." path="/search" />
      <div className="container py-12">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-semibold tracking-tight">Find your stay</h1>
          <p className="mt-2 text-muted-foreground">Describe your trip — city, budget, vibe. Our AI ranks real listings by actual value.</p>
        </div>

        <form onSubmit={run} className="mt-6 flex gap-2 max-w-2xl">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="2 nights in Quezon City, budget ₱2,000, need WiFi…" className="flex-1" disabled={searchLimitReached} />
          <Button type="submit" disabled={loading || searchLimitReached}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Sparkles className="h-4 w-4 mr-1" /> Search</>}
          </Button>
        </form>

        {searchLimitReached ? (
          <div className="mt-4 max-w-2xl rounded-xl border border-amber-400/40 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-amber-600 shrink-0" />
              <span className="text-amber-800 dark:text-amber-300">You've used all {DAILY_SEARCH_LIMIT} free AI searches today.</span>
            </div>
            <Button size="sm" asChild>
              <Link to="/membership">Upgrade for unlimited</Link>
            </Button>
          </div>
        ) : user && !memberUser ? (
          <p className="mt-2 text-xs text-muted-foreground max-w-2xl">
            {searchesRemaining} of {DAILY_SEARCH_LIMIT} free searches remaining today ·{" "}
            <Link to="/membership" className="underline underline-offset-2 hover:text-foreground">Upgrade for unlimited</Link>
          </p>
        ) : null}

        {summary && (
          <p className="mt-4 text-sm text-muted-foreground max-w-2xl border-l-2 border-primary/40 pl-3">{summary}</p>
        )}

        {/* Sort + Filter bar */}
        {(searched || results.length > 0) && !loading && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="w-44 h-9 text-sm">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Best deal</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
                <SelectItem value="rating">Highest rated</SelectItem>
              </SelectContent>
            </Select>

            {/* Quick filter chips */}
            <FilterChip active={filters.instantBook} onClick={() => setFilters((f) => ({ ...f, instantBook: !f.instantBook }))}>
              <Zap className="h-3 w-3 inline mr-1" />Instant book
            </FilterChip>
            <FilterChip active={filters.ownerDirect} onClick={() => setFilters((f) => ({ ...f, ownerDirect: !f.ownerDirect }))}>
              Owner direct
            </FilterChip>

            {/* Full filter panel */}
            <Sheet open={filterOpen} onOpenChange={setFilterOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 ml-auto">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters
                  {numFilters > 0 && (
                    <span className="ml-0.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center">{numFilters}</span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Filter results</SheetTitle>
                </SheetHeader>

                <div className="space-y-7 mt-6">
                  {/* Price */}
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Max price per night</p>
                    <Slider
                      min={500}
                      max={20000}
                      step={250}
                      value={[filters.maxPrice]}
                      onValueChange={([v]) => setFilters((f) => ({ ...f, maxPrice: v }))}
                    />
                    <p className="text-sm text-muted-foreground">Up to ₱{filters.maxPrice.toLocaleString()}</p>
                  </div>

                  {/* Bedrooms */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Bedrooms</p>
                    <div className="flex gap-2 flex-wrap">
                      {[0, 1, 2, 3, 4].map((n) => (
                        <FilterChip key={n} active={filters.minBedrooms === n} onClick={() => setFilters((f) => ({ ...f, minBedrooms: n }))}>
                          {n === 0 ? "Any" : `${n}+`}
                        </FilterChip>
                      ))}
                    </div>
                  </div>

                  {/* Guests */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Guests</p>
                    <div className="flex gap-2 flex-wrap">
                      {[1, 2, 4, 6, 8, 10].map((n) => (
                        <FilterChip key={n} active={filters.minGuests === n} onClick={() => setFilters((f) => ({ ...f, minGuests: n }))}>
                          {n}+
                        </FilterChip>
                      ))}
                    </div>
                  </div>

                  {/* Property type */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Property type</p>
                    <div className="flex gap-2 flex-wrap">
                      {Object.entries(TYPE_LABELS).map(([value, label]) => (
                        <FilterChip key={value} active={filters.types.includes(value)} onClick={() => toggleType(value)}>
                          {label}
                        </FilterChip>
                      ))}
                    </div>
                  </div>

                  {/* Amenities */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Amenities</p>
                    <div className="flex gap-2 flex-wrap">
                      {FILTER_AMENITIES.map((a) => (
                        <FilterChip key={a} active={filters.amenities.includes(a)} onClick={() => toggleAmenity(a)}>
                          {AMENITY_LABELS[a]}
                        </FilterChip>
                      ))}
                    </div>
                  </div>

                  {/* Booking options */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Booking</p>
                    <div className="flex gap-2 flex-wrap">
                      <FilterChip active={filters.instantBook} onClick={() => setFilters((f) => ({ ...f, instantBook: !f.instantBook }))}>
                        Instant book
                      </FilterChip>
                      <FilterChip active={filters.ownerDirect} onClick={() => setFilters((f) => ({ ...f, ownerDirect: !f.ownerDirect }))}>
                        Owner direct
                      </FilterChip>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button className="flex-1" onClick={() => setFilterOpen(false)}>Apply</Button>
                    {numFilters > 0 && (
                      <Button variant="outline" onClick={resetFilters} className="gap-1">
                        <X className="h-3.5 w-3.5" /> Clear
                      </Button>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>

            {numFilters > 0 && (
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {results.length} results
              </span>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => <CardSkeleton key={n} />)}
          </div>
        )}

        {!loading && searched && filtered.length === 0 && (
          <div className="mt-12 text-center text-muted-foreground">
            <p className="text-lg">{results.length === 0 ? "No matches found." : "No results match your filters."}</p>
            <p className="text-sm mt-1">
              {results.length === 0
                ? "Try a different city, adjust your budget, or broaden your description."
                : "Try removing some filters."}
            </p>
            {results.length > 0 && numFilters > 0 && (
              <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>Clear filters</Button>
            )}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => <ListingCard key={r.id} listing={r} guestRating={hostRatings.get(r.host_id)} />)}
          </div>
        )}

        {!loading && !searched && browseLoading && (
          <div className="mt-10">
            <h2 className="text-lg font-medium mb-4">Browse latest stays</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((n) => <CardSkeleton key={n} />)}
            </div>
          </div>
        )}

        {!loading && !searched && browseListings.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-medium mb-4">Browse latest stays</h2>
            <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3")}>
              {browseListings.map((r) => <ListingCard key={r.id} listing={r} guestRating={hostRatings.get(r.host_id)} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
