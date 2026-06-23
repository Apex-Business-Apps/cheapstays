import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MapPin, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AtmosphericSection } from "@/components/AtmosphericSection";
import { fetchPopularCities, type PopularCity } from "@/lib/discovery";
import { getListingPrimaryImage } from "@/lib/listings";
import cityCebu from "@/assets/city-cebu.jpg";
import cityDavao from "@/assets/city-davao.jpg";
import cityTagaytay from "@/assets/city-tagaytay.jpg";
import cityLaUnion from "@/assets/city-launion.jpg";
import cityDumaguete from "@/assets/city-dumaguete.jpg";
import cityCoron from "@/assets/city-coron.jpg";
import cityIloilo from "@/assets/city-iloilo.jpg";
import cityCamiguin from "@/assets/city-camiguin.jpg";
import s1 from "@/assets/stay-1.jpg";
import s2 from "@/assets/stay-2.jpg";
import s3 from "@/assets/stay-3.jpg";
import s4 from "@/assets/stay-4.jpg";
import s5 from "@/assets/stay-5.jpg";
import s6 from "@/assets/stay-6.jpg";
import s7 from "@/assets/stay-7.jpg";
import { ease } from "./constants";

// Maps a city/area name to a representative image when the listing has no photo.
const CITY_IMAGE_RULES: { match: string[]; img: string }[] = [
  { match: ["cebu"], img: cityCebu },
  { match: ["davao"], img: cityDavao },
  { match: ["tagaytay"], img: cityTagaytay },
  { match: ["la union", "san juan"], img: cityLaUnion },
  { match: ["dumaguete"], img: cityDumaguete },
  { match: ["coron"], img: cityCoron },
  { match: ["iloilo"], img: cityIloilo },
  { match: ["camiguin", "mambajao"], img: cityCamiguin },
  { match: ["el nido"], img: s1 },
  { match: ["siargao", "general luna"], img: s2 },
  { match: ["bohol", "carmen", "batuan"], img: s3 },
  { match: ["batanes", "basco"], img: s4 },
  { match: ["vigan"], img: s5 },
  { match: ["boracay"], img: s6 },
  { match: ["baguio"], img: s7 },
];

function cityImage(city: PopularCity): string | null {
  const name = city.city.toLowerCase();
  for (const rule of CITY_IMAGE_RULES) {
    if (rule.match.some((m) => name.includes(m))) return rule.img;
  }
  return getListingPrimaryImage(city.sample);
}

function CityCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/60 overflow-hidden">
      <Skeleton className="aspect-[5/4] w-full rounded-none" />
      <div className="p-5 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function PopularCitiesSection() {
  const [cities, setCities] = useState<PopularCity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPopularCities(4);
        if (!cancelled) setCities(data);
      } catch {
        if (!cancelled) setCities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AtmosphericSection as="div" variant="city" parallaxStrength="subtle" className="snap-landing-panel">
      <section className="container py-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="max-w-xl">
            <Badge variant="secondary" className="mb-3 uppercase tracking-wider text-xs">
              <MapPin className="h-3 w-3 mr-1" /> Popular cities
            </Badge>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Where travelers are booking now</h2>
            <p className="mt-3 text-muted-foreground">
              The destinations with the most owner-direct stays. Tap any city to see live listings.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/popular-cities">View all cities <ArrowRight className="ml-2 h-4 w-4" /></Link>
          </Button>
        </div>

        {!loading && cities.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-20">
            <div className="h-14 w-14 rounded-2xl bg-secondary/60 ring-1 ring-border/60 grid place-items-center mb-4">
              <MapPinned className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium tracking-tight">No cities to show yet</h3>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
              As hosts publish listings, the most popular destinations will appear here.
            </p>
            <Button variant="outline" className="mt-5" asChild>
              <Link to="/search">Browse all stays <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {loading ? (
              [1, 2, 3, 4].map((n) => <CityCardSkeleton key={n} />)
            ) : (
              cities.map((c, idx) => {
              const img = cityImage(c);
              return (
                <motion.div
                  key={c.city}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-60px" }}
                  transition={{ duration: 0.6, delay: idx * 0.05, ease }}
                >
                  <Card className="group relative overflow-hidden border-border/60 bg-card/95 p-0 h-full transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_80px_-40px_hsl(150_30%_10%/0.5)]">
                    <Link to={`/search?q=${encodeURIComponent(c.city)}`} className="absolute inset-0 z-10" aria-label={`Search stays in ${c.city}`} />
                    <div className="relative aspect-[5/4] overflow-hidden bg-gradient-to-br from-secondary/60 to-accent/10">
                      {img && (
                        <img src={img} alt={`${c.city}, ${c.province}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform [transition-duration:1400ms] ease-out group-hover:scale-[1.08]" />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 via-transparent to-transparent" />
                      <span className="absolute top-4 right-4 text-[10px] uppercase tracking-[0.18em] bg-background/85 backdrop-blur text-foreground px-2.5 py-1 rounded-full ring-1 ring-border/60">
                        {c.count} {c.count === 1 ? "stay" : "stays"}
                      </span>
                    </div>
                    <div className="p-5">
                      <h3 className="text-lg font-medium tracking-tight">{c.city}</h3>
                      <p className="text-sm text-muted-foreground">{c.province}</p>
                      {c.fromPrice > 0 && (
                        <p className="mt-2 text-sm">
                          <span className="text-muted-foreground">from </span>
                          <span className="font-semibold text-primary">₱{c.fromPrice.toLocaleString()}</span>
                          <span className="text-muted-foreground text-xs"> / night</span>
                        </p>
                      )}
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
