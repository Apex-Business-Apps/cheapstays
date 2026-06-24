import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, MapPin, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { fetchQuickStays, type DiscoveryListing } from "@/lib/discovery";
import { getListingPrimaryImage, getListingImageAlt, getListingTypeEmoji } from "@/lib/listings";
import { ease } from "./constants";

const STAY_TYPES = [
  { label: "Motel rooms", to: "/search?category=motel_room" },
  { label: "Hotel rooms", to: "/search?category=hotel_room" },
  { label: "Hourly stays", to: "/search?availability=hourly" },
  { label: "Private pools", to: "/search?category=private_pool" },
];

const CATEGORY_LABELS: Record<string, string> = {
  quick_stay: "Quick Stay",
  hourly_stay: "Hourly Stay",
  motel_room: "Motel",
  hotel_room: "Hotel",
  private_pool: "Private Pool",
  condo: "Condo",
  apartment: "Apartment",
  hostel: "Hostel",
  overnight_stay: "Overnight",
};

function peso(n: number | null): string {
  return n != null && n > 0 ? `₱${n.toLocaleString()}` : "—";
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-5 space-y-3">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

export function QuickStaysSection() {
  const [stays, setStays] = useState<DiscoveryListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchQuickStays(3);
        if (!cancelled) setStays(data);
      } catch {
        if (!cancelled) setStays([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AtmosphericSection as="div" variant="city" parallaxStrength="subtle" className="snap-landing-panel">
      <section className="container py-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <Clock className="h-3 w-3 mr-1" /> Quick stay vouchers
            </Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Need just a few hours?</h2>
            <p className="mt-3 text-muted-foreground">
              Hotels and motels offering hourly rooms — pick a 3, 6, or 12-hour block and only pay for the time you need.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/vouchers">View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>

        <div className="mb-10 flex flex-wrap gap-2">
          {STAY_TYPES.map((t) => (
            <Link
              key={t.label}
              to={t.to}
              className="px-3 py-1.5 rounded-full text-sm border border-border/60 bg-background/70 backdrop-blur hover:border-primary/40 transition-colors"
            >
              {t.label}
            </Link>
          ))}
        </div>

        {!loading && stays.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="h-14 w-14 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center mb-4">
              <Clock className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium tracking-tight">No quick stays yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              When hosts list hotels or motels with hourly rooms, they'll show up here.
            </p>
            <Button variant="outline" className="mt-5" asChild>
              <Link to="/search">Browse all stays <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              [1, 2, 3].map((n) => <CardSkeleton key={n} />)
            ) : (
              stays.map((s, idx) => {
                const img = getListingPrimaryImage(s);
                const to = s.slug ? `/listing/slug/${s.slug}` : `/listing/${s.id}`;
                const kind = (s.stay_category && CATEGORY_LABELS[s.stay_category]) || "Quick Stay";
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.6, delay: idx * 0.05, ease }}
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
                        <Badge variant="secondary" className="absolute top-3 left-3 text-[10px]">{kind}</Badge>
                        <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] bg-background/85 backdrop-blur text-foreground px-2.5 py-1 rounded-full ring-1 ring-border/60"><Clock className="h-3 w-3" /> Hourly</span>
                      </div>
                      <div className="p-5 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="text-lg font-medium tracking-tight line-clamp-1">{s.title}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" /> {s.city}, {s.province}</p>
                          </div>
                          {s.avg_rating != null && (
                            <span className="flex items-center gap-0.5 text-sm shrink-0"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> {s.avg_rating.toFixed(1)}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {[["3 hrs", s.price_3h], ["6 hrs", s.price_6h], ["12 hrs", s.price_12h]].map(([label, price]) => (
                            <div key={label as string} className="rounded-lg bg-secondary/50 px-2 py-2 text-center">
                              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label as string}</p>
                              <p className="text-sm font-semibold text-primary mt-0.5">{peso(price as number | null)}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                );
              })
            )}
          </div>
        )}
      </section>
    </AtmosphericSection>
  );
}
