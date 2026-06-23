import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, BedDouble, MapPin, Sparkles, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { fetchFeaturedStays, isPromoted, type DiscoveryListing } from "@/lib/discovery";
import { getListingPrimaryImage, getListingImageAlt } from "@/lib/listings";
import { ease } from "./constants";

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

export function FeaturedStaysSection() {
  const [stays, setStays] = useState<DiscoveryListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFeaturedStays(6);
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
    <AtmosphericSection as="div" variant="beach" parallaxStrength="subtle" className="snap-landing-panel">
      <section className="container py-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> Featured stays
            </Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Promoted &amp; top-rated stays</h2>
            <p className="mt-3 text-muted-foreground">
              Discounted and highest-rated owner-direct places on CheapStays right now.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/featured-stays">View all <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>

        {!loading && stays.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="h-14 w-14 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center mb-4">
              <Sparkles className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium tracking-tight">No featured stays yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              Once hosts publish and promote listings, the standout stays will show up here.
            </p>
            <Button variant="outline" className="mt-5" asChild>
              <Link to="/search">Browse all stays <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              [1, 2, 3, 4, 5, 6].map((n) => <StayCardSkeleton key={n} />)
            ) : (
              stays.map((s, idx) => {
                const img = getListingPrimaryImage(s);
                const to = s.slug ? `/listing/slug/${s.slug}` : `/listing/${s.id}`;
                const promo = isPromoted(s);
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
                        {img && (
                          <img src={img} alt={getListingImageAlt(s)} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1400ms] ease-out group-hover:scale-[1.08]" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/45 via-transparent to-transparent" />
                        <Badge variant={promo ? "default" : "secondary"} className="absolute top-3 right-3 text-[10px]">
                          {promo ? "Promo" : "Featured"}
                        </Badge>
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
                          <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {s.type.replace(/_/g, " ")}</span>
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
              })
            )}
          </div>
        )}
      </section>
    </AtmosphericSection>
  );
}
