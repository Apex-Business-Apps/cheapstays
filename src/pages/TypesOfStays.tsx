import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BedDouble,
  Clock,
  LayoutGrid,
  MapPin,
  Search as SearchIcon,
  SlidersHorizontal,
  Star,
  Users,
  Waves,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Seo } from "@/components/Seo";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { fetchActiveListings, isPromoted, type DiscoveryListing } from "@/lib/discovery";
import { getListingPrimaryImage, getListingImageAlt, getListingTypeEmoji } from "@/lib/listings";

const ease = [0.22, 1, 0.36, 1] as const;

type TabDef = {
  id: string;
  label: string;
  desc: string;
  icon: typeof LayoutGrid;
  match: (l: DiscoveryListing) => boolean;
};

const TABS: TabDef[] = [
  { id: "all", label: "All Stays", desc: "Browse all listings", icon: LayoutGrid, match: () => true },
  {
    id: "overnight",
    label: "Overnight Stays",
    desc: "Condos & Airbnb-style stays",
    icon: BedDouble,
    match: (l) => l.stay_availability_type === "overnight" || l.stay_availability_type === "both",
  },
  {
    id: "quick",
    label: "Quick Stays",
    desc: "Motels & hourly stays",
    icon: Clock,
    match: (l) => l.stay_availability_type === "hourly" || l.stay_availability_type === "both",
  },
  {
    id: "hostels",
    label: "Hostels",
    desc: "Budget shared stays",
    icon: Users,
    match: (l) => l.stay_category === "hostel" || l.type === "shared_room",
  },
  {
    id: "pools",
    label: "Private Pools",
    desc: "Resort & pool listings",
    icon: Waves,
    match: (l) =>
      l.stay_category === "private_pool" ||
      l.type === "villa" ||
      l.type === "resort" ||
      l.amenities.includes("pool") ||
      l.amenities.includes("private_pool"),
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  quick_stay: "Quick Stay",
  hourly_stay: "Hourly Stay",
  overnight_stay: "Overnight",
  hostel: "Hostel",
  private_pool: "Private Pool",
  condo: "Condo",
  apartment: "Apartment",
  hotel_room: "Hotel",
  motel_room: "Motel",
};

const PRICE_OPTIONS = [
  { label: "Any price", value: 0 },
  { label: "≤ ₱1,000", value: 1000 },
  { label: "≤ ₱2,000", value: 2000 },
  { label: "≤ ₱3,000", value: 3000 },
  { label: "≤ ₱5,000", value: 5000 },
];

const GUEST_OPTIONS = [
  { label: "Any guests", value: 0 },
  { label: "1+", value: 1 },
  { label: "2+", value: 2 },
  { label: "4+", value: 4 },
  { label: "6+", value: 6 },
];

const AMENITY_OPTIONS: { value: string; label: string }[] = [
  { value: "wifi", label: "WiFi" },
  { value: "aircon", label: "Air conditioning" },
  { value: "kitchen", label: "Kitchen" },
  { value: "pool", label: "Pool" },
  { value: "parking", label: "Parking" },
  { value: "hot_water", label: "Hot water" },
];

function StayCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-5 space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
      </div>
    </div>
  );
}

function StayCard({ s, idx }: { s: DiscoveryListing; idx: number }) {
  const img = getListingPrimaryImage(s);
  const to = s.slug ? `/listing/slug/${s.slug}` : `/listing/${s.id}`;
  const promo = isPromoted(s);
  const kind = (s.stay_category && CATEGORY_LABELS[s.stay_category]) || s.type.replace(/_/g, " ");
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(idx, 8) * 0.03, ease }}
    >
      <Card className="group relative overflow-hidden border-border/60 bg-card/95 p-0 h-full transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_80px_-40px_hsl(150_30%_10%/0.5)]">
        <Link to={to} className="absolute inset-0 z-10" aria-label={`View ${s.title}`} />
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-secondary/60 to-accent/10">
          {img ? (
            <img src={img} alt={getListingImageAlt(s)} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1400ms] ease-out group-hover:scale-[1.08]" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-6xl opacity-20 select-none">{getListingTypeEmoji(s.type)}</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent" />
          <Badge variant="secondary" className="absolute top-3 left-3 text-[10px] capitalize">{kind}</Badge>
          {promo && <Badge className="absolute top-3 right-3 text-[10px]">Promo</Badge>}
        </div>
        <div className="p-5 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-lg font-medium tracking-tight line-clamp-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {s.city}, {s.province}</p>
            </div>
            {s.avg_rating != null && (
              <span className="flex items-center gap-0.5 text-sm shrink-0"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {s.avg_rating.toFixed(1)}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" /> up to {s.max_guests}</span>
            <span className="ml-auto text-sm">
              {promo ? (
                <>
                  <span className="text-muted-foreground line-through mr-1.5">₱{s.nightly_php.toLocaleString()}</span>
                  <span className="font-semibold text-primary">₱{s.promo_price!.toLocaleString()}</span>
                </>
              ) : (
                <span className="font-semibold text-primary">₱{s.nightly_php.toLocaleString()}</span>
              )}
              <span className="text-muted-foreground text-xs"> / night</span>
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function TypesOfStays() {
  const [listings, setListings] = useState<DiscoveryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [tab, setTab] = useState("all");
  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState(0);
  const [minGuests, setMinGuests] = useState(0);
  const [amenities, setAmenities] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchActiveListings(200);
        if (!cancelled) setListings(data);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function toggleAmenity(a: string) {
    setAmenities((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  }

  function clearFilters() {
    setCity("");
    setMaxPrice(0);
    setMinGuests(0);
    setAmenities([]);
  }

  // Filters apply across every tab; tab counts reflect the active filters.
  const filtered = useMemo(() => {
    const q = city.trim().toLowerCase();
    return listings.filter((l) => {
      if (q && !`${l.city} ${l.province} ${l.title}`.toLowerCase().includes(q)) return false;
      if (maxPrice && l.nightly_php > maxPrice) return false;
      if (minGuests && l.max_guests < minGuests) return false;
      if (amenities.length && !amenities.every((a) => l.amenities.includes(a))) return false;
      return true;
    });
  }, [listings, city, maxPrice, minGuests, amenities]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of TABS) map[t.id] = filtered.filter(t.match).length;
    return map;
  }, [filtered]);

  const activeTab = TABS.find((t) => t.id === tab) ?? TABS[0];
  const results = useMemo(() => filtered.filter(activeTab.match), [filtered, activeTab]);
  const hasFilters = city.trim() !== "" || maxPrice > 0 || minGuests > 0 || amenities.length > 0;

  return (
    <div>
      <Seo
        title="Types of Stays · CheapStays"
        description="Browse every kind of stay on CheapStays — all stays, overnight condos, quick hourly motels, hostels, and private-pool villas. Filter by city, price, guests, and amenities."
        path="/types-of-stays"
      />
      <AtmosphericSection as="div" variant="city" parallaxStrength="subtle">
        <section className="container py-16 md:py-20">
          <div className="max-w-2xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <LayoutGrid className="h-3 w-3 mr-1" /> Types of stays
            </Badge>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
              Every kind of stay, <span className="text-accent">one fair marketplace</span>.
            </h1>
            <p className="mt-4 text-muted-foreground">
              Pick how you want to stay, then narrow it down by city, price, guests, and amenities.
            </p>
          </div>

          {/* Tabs */}
          <div className="mt-10 flex flex-wrap gap-2">
            {TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`group inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border/60 bg-background/70 backdrop-blur hover:border-foreground/30"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                  {!loading && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground"}`}>
                      {counts[t.id] ?? 0}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{activeTab.desc}</p>

          {/* Filters */}
          <div className="mt-6 rounded-2xl border border-border/60 bg-card/80 backdrop-blur p-4 md:p-5">
            <div className="flex items-center gap-2 mb-4 text-sm font-medium text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" /> Filters
              {hasFilters && (
                <button onClick={clearFilters} className="ml-auto text-xs text-primary hover:underline underline-offset-4">
                  Clear all
                </button>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City or area"
                  aria-label="Filter by city"
                  className="pl-9 bg-background/90"
                />
              </div>
              <select
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                aria-label="Filter by price"
                className="h-10 rounded-md border border-input bg-background/90 px-3 text-sm"
              >
                {PRICE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                value={minGuests}
                onChange={(e) => setMinGuests(Number(e.target.value))}
                aria-label="Filter by guests"
                className="h-10 rounded-md border border-input bg-background/90 px-3 text-sm"
              >
                {GUEST_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => {
                const on = amenities.includes(a.value);
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => toggleAmenity(a.value)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      on ? "bg-primary text-primary-foreground border-primary" : "border-border/60 hover:border-foreground/30"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Results */}
          <div className="mt-10">
            {loading ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((n) => <StayCardSkeleton key={n} />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center text-center py-24">
                <h2 className="text-xl font-medium tracking-tight">Couldn't load stays</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">Something went wrong fetching listings. Please try again.</p>
                <Button className="mt-6" onClick={() => window.location.reload()}>Retry</Button>
              </div>
            ) : results.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-24">
                <div className="h-16 w-16 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center mb-5">
                  <activeTab.icon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-medium tracking-tight">No {activeTab.label.toLowerCase()} found</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {hasFilters
                    ? "No stays match your current filters. Try clearing some of them."
                    : "There are no listings in this category yet — check back soon."}
                </p>
                {hasFilters ? (
                  <Button variant="outline" className="mt-6" onClick={clearFilters}>Clear filters</Button>
                ) : (
                  <Button className="mt-6" asChild>
                    <Link to="/search">Browse all stays <ArrowRight className="ml-2 h-4 w-4" /></Link>
                  </Button>
                )}
              </div>
            ) : (
              <>
                <p className="mb-6 text-sm text-muted-foreground">
                  {results.length} {results.length === 1 ? "stay" : "stays"}
                </p>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {results.map((s, idx) => <StayCard key={s.id} s={s} idx={idx} />)}
                </div>
              </>
            )}
          </div>
        </section>
      </AtmosphericSection>
    </div>
  );
}
