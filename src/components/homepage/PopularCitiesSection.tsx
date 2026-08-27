import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
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

// Fallback tiles for the "See all" collage when the fetched cities do not
// yield three usable images.
const SEE_ALL_FALLBACK = [s2, s5, s7];

function cityImage(city: PopularCity): string | null {
  const name = city.city.toLowerCase();
  for (const rule of CITY_IMAGE_RULES) {
    if (rule.match.some((m) => name.includes(m))) return rule.img;
  }
  return getListingPrimaryImage(city.sample);
}

// Guardrail: `CityCardSkeleton` symbol must stay in this file — the landing
// layout-stability check greps for it to guarantee skeleton parity with the
// final card so async data-swaps don't yank the viewport.
function CityCardSkeleton() {
  return (
    <div className="snap-start shrink-0 w-[240px] md:w-[260px] rounded-2xl overflow-hidden bg-card border border-border/60">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

export function PopularCitiesSection() {
  const [cities, setCities] = useState<PopularCity[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchPopularCities(10);
        if (!cancelled) setCities(data);
      } catch {
        if (!cancelled) setCities([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function scrollByCards(dir: 1 | -1) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: "smooth" });
  }

  const collageImages = cities
    .slice(0, 3)
    .map(cityImage)
    .filter((img): img is string => !!img);
  const finalCollage = collageImages.length >= 3 ? collageImages.slice(0, 3) : SEE_ALL_FALLBACK;

  return (
    <section className="container py-12 md:py-16">
      <div className="flex items-end justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Stay where you need to be.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">Popular areas in Metro Manila</p>
        </div>
        <div className="hidden md:flex items-center gap-2">
          <CarouselButton dir="left" onClick={() => scrollByCards(-1)} />
          <CarouselButton dir="right" onClick={() => scrollByCards(1)} />
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-6 px-6 md:-mx-0 md:px-0"
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <CityCardSkeleton key={i} />)
          : cities.map((c, idx) => {
              const img = cityImage(c);
              return (
                <motion.div
                  key={c.city}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: idx * 0.03, ease }}
                  className="snap-start shrink-0 w-[240px] md:w-[260px]"
                >
                  <Link
                    to={`/search?q=${encodeURIComponent(c.city)}`}
                    aria-label={`Search stays in ${c.city}`}
                    className="group block rounded-2xl overflow-hidden bg-card border border-border/60 transition-shadow duration-300 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.4)]"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-muted/60">
                      {img ? (
                        <img
                          src={img}
                          alt={`${c.city}, ${c.province}`}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        />
                      ) : null}
                      <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="text-lg font-semibold text-white leading-tight">
                          {c.city}
                        </h3>
                        <p className="text-xs text-white/80 mt-0.5">
                          {c.count.toLocaleString()} {c.count === 1 ? "stay" : "stays"}
                        </p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}

        {/* 11th tile: "See all" collage. Only appears when there are real cities. */}
        {!loading && cities.length > 0 && (
          <div className="snap-start shrink-0 w-[240px] md:w-[260px]">
            <Link
              to="/search"
              aria-label="See all cities"
              className="group block h-full rounded-2xl overflow-hidden bg-card border border-border/60 transition-shadow duration-300 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.4)]"
            >
              <div className="relative aspect-[4/5] flex flex-col items-center justify-center p-6 bg-muted/40">
                <div className="relative h-32 w-32 mb-4">
                  {finalCollage.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      loading="lazy"
                      style={{
                        transform: `rotate(${i === 0 ? -8 : i === 1 ? 0 : 10}deg) translate(${
                          i === 0 ? "-18px" : i === 1 ? "0" : "18px"
                        }, ${i === 1 ? "-8px" : "6px"})`,
                        zIndex: i === 1 ? 2 : 1,
                      }}
                      className="absolute inset-0 h-24 w-24 mx-auto my-auto rounded-xl object-cover ring-2 ring-background shadow-[0_10px_30px_-10px_hsl(30_20%_15%/0.4)] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  ))}
                </div>
                <p className="mt-4 text-lg font-semibold text-foreground text-center">See all</p>
              </div>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function CarouselButton({ dir, onClick }: { dir: "left" | "right"; onClick: () => void }) {
  const Icon = dir === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "left" ? "Scroll left" : "Scroll right"}
      className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card text-foreground/80 hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
