import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ChevronLeft, ChevronRight, Heart, Star } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchFeaturedStays, isPromoted, type DiscoveryListing } from "@/lib/discovery";
import { getListingPrimaryImage, getListingImageAlt } from "@/lib/listings";
import s2 from "@/assets/stay-2.jpg";
import s5 from "@/assets/stay-5.jpg";
import s7 from "@/assets/stay-7.jpg";
import { ease } from "./constants";

const SEE_ALL_FALLBACK = [s2, s5, s7];

const AMENITY_LABELS: Record<string, string> = {
  wifi: "Wi-Fi",
  aircon: "AC",
  kitchen: "Kitchen",
  pool: "Pool",
  parking: "Parking",
  hot_water: "Hot water",
  gym: "Gym",
};

function amenityLabel(a: string): string {
  return AMENITY_LABELS[a] ?? a.replace(/_/g, " ");
}

// Guardrail: `StayCardSkeleton` symbol must stay in this file — the landing
// layout-stability check greps for it so async data-swaps do not reshape
// the section.
function StayCardSkeleton() {
  return (
    <div className="snap-start shrink-0 w-[260px] md:w-[280px] rounded-2xl overflow-hidden bg-card border border-border/60">
      <Skeleton className="aspect-[4/3] w-full rounded-none" />
      <div className="p-4 space-y-2">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-2/5" />
      </div>
    </div>
  );
}

export function FeaturedStaysSection() {
  const [stays, setStays] = useState<DiscoveryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchFeaturedStays(10);
        if (!cancelled) setStays(data);
      } catch {
        if (!cancelled) setStays([]);
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

  const collage = stays
    .slice(0, 3)
    .map(getListingPrimaryImage)
    .filter((img): img is string => !!img);
  const finalCollage = collage.length >= 3 ? collage.slice(0, 3) : SEE_ALL_FALLBACK;

  return (
    <section className="container py-12 md:py-16">
      <div className="flex items-end justify-between gap-4 mb-6">
        <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
          Affordable stays you'll love
        </h2>
        <div className="flex items-center gap-3">
          <Link
            to="/search"
            className="hidden sm:inline-flex items-center gap-1.5 text-sm font-medium text-foreground/80 hover:text-foreground"
          >
            View all stays <ArrowRight className="h-4 w-4" />
          </Link>
          <div className="hidden md:flex items-center gap-2">
            <CarouselButton dir="left" onClick={() => scrollByCards(-1)} />
            <CarouselButton dir="right" onClick={() => scrollByCards(1)} />
          </div>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-2 -mx-6 px-6 md:-mx-0 md:px-0"
      >
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <StayCardSkeleton key={i} />)
          : stays.map((s, idx) => {
              const img = getListingPrimaryImage(s);
              const to = s.slug ? `/listing/slug/${s.slug}` : `/listing/${s.id}`;
              const promo = isPromoted(s);
              const chips = [s.type.replace(/_/g, " "), ...s.amenities.slice(0, 2).map(amenityLabel)];
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: idx * 0.03, ease }}
                  className="snap-start shrink-0 w-[260px] md:w-[280px]"
                >
                  <Link
                    to={to}
                    aria-label={`View ${s.title}`}
                    className="group block rounded-2xl overflow-hidden bg-card border border-border/60 transition-shadow duration-300 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.4)]"
                  >
                    <div className="relative aspect-[4/3] overflow-hidden bg-muted/60">
                      {img ? (
                        <img
                          src={img}
                          alt={getListingImageAlt(s)}
                          loading="lazy"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                        />
                      ) : null}
                      {s.avg_rating != null && (
                        <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-card/90 backdrop-blur px-2 py-1 text-xs font-medium text-foreground shadow-sm">
                          <Star className="h-3 w-3 fill-primary text-primary" /> {s.avg_rating.toFixed(1)}
                        </span>
                      )}
                      <span
                        aria-hidden
                        className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-card/90 backdrop-blur text-foreground/70"
                      >
                        <Heart className="h-4 w-4" />
                      </span>
                    </div>
                    <div className="p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        {s.city}{s.province ? `, ${s.province}` : ""}
                      </p>
                      <h3 className="mt-1 text-base font-semibold text-foreground line-clamp-1">
                        {s.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-muted-foreground">
                        {chips.join(" · ")}
                      </p>
                      <p className="mt-3 text-sm">
                        {promo && s.promo_price != null ? (
                          <>
                            <span className="text-muted-foreground line-through mr-1.5">
                              ₱{s.nightly_php.toLocaleString()}
                            </span>
                            <span className="font-semibold text-foreground">
                              ₱{s.promo_price.toLocaleString()}
                            </span>
                          </>
                        ) : (
                          <span className="font-semibold text-foreground">
                            ₱{s.nightly_php.toLocaleString()}
                          </span>
                        )}
                        <span className="text-muted-foreground"> / night</span>
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}

        {/* 11th tile: "See all" collage. Only appears when there are real stays. */}
        {!loading && stays.length > 0 && (
          <div className="snap-start shrink-0 w-[260px] md:w-[280px]">
            <Link
              to="/search"
              aria-label="See all stays"
              className="group block h-full rounded-2xl overflow-hidden bg-card border border-border/60 transition-shadow duration-300 hover:shadow-[0_20px_60px_-30px_hsl(30_20%_15%/0.4)]"
            >
              <div className="relative aspect-[4/3] flex flex-col items-center justify-center bg-muted/40">
                <div className="relative h-28 w-28">
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
                      className="absolute inset-0 h-20 w-20 mx-auto my-auto rounded-xl object-cover ring-2 ring-background shadow-[0_10px_30px_-10px_hsl(30_20%_15%/0.4)] transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                    />
                  ))}
                </div>
              </div>
              <div className="p-4 text-center">
                <p className="text-base font-semibold text-foreground">See all</p>
                <p className="mt-1 text-xs text-muted-foreground">Browse every stay</p>
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
