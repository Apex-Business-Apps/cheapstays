import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";

type Variant = "hero" | "modal" | "row";

type Props = {
  images: string[];
  title?: string;
  variant?: Variant;
};

/**
 * One photo surface across the app — hero on public listing detail, mini
 * preview in the edit modal, thumbnail on host row cards. Uses embla directly
 * (not the shadcn wrapper) because we need per-variant chrome and pagination
 * dots, which the wrapper doesn't expose.
 */
export function ListingPhotoCarousel({ images, title, variant = "hero" }: Props) {
  if (images.length === 0) return null;

  if (variant === "row" && images.length === 1) {
    return <StaticThumb src={images[0]} alt={title ?? "Listing photo"} />;
  }

  return <CarouselCore images={images} title={title} variant={variant} />;
}

function CarouselCore({ images, title, variant }: { images: string[]; title?: string; variant: Variant }) {
  const [emblaRef, embla] = useEmblaCarousel({ loop: images.length > 1 });
  const [current, setCurrent] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (!embla) return;
    const sync = () => setCurrent(embla.selectedScrollSnap());
    sync();
    embla.on("select", sync);
    embla.on("reInit", sync);
    return () => {
      embla.off("select", sync);
      embla.off("reInit", sync);
    };
  }, [embla]);

  const scrollTo = useCallback((i: number) => embla?.scrollTo(i), [embla]);
  const scrollPrev = useCallback(() => embla?.scrollPrev(), [embla]);
  const scrollNext = useCallback(() => embla?.scrollNext(), [embla]);

  const openLightbox = variant === "hero" ? (i: number) => setLightbox(i) : undefined;

  const aspect =
    variant === "hero" ? "aspect-[16/9]" :
    variant === "modal" ? "aspect-[4/3]" :
    "aspect-[4/3]"; // row

  const rounded =
    variant === "row" ? "rounded-lg" : "rounded-xl";

  const arrowSize = variant === "row" ? "h-6 w-6" : "h-9 w-9";
  const arrowInset = variant === "row" ? "left-1 right-1" : "left-3 right-3";

  return (
    <>
      <div className={cn("relative group overflow-hidden bg-muted", rounded, aspect)}>
        <div className="overflow-hidden h-full" ref={emblaRef}>
          <div className="flex h-full">
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => openLightbox?.(i)}
                className={cn(
                  "relative min-w-0 shrink-0 grow-0 basis-full h-full",
                  openLightbox ? "cursor-zoom-in" : "cursor-default",
                )}
                aria-label={`Photo ${i + 1} of ${images.length}`}
                tabIndex={-1}
              >
                <img
                  src={url}
                  alt={`${title ?? "Photo"} ${i + 1}`}
                  className="w-full h-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                  draggable={false}
                />
              </button>
            ))}
          </div>
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); scrollPrev(); }}
              aria-label="Previous photo"
              className={cn(
                "absolute top-1/2 -translate-y-1/2 grid place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 transition-opacity",
                arrowSize,
                arrowInset.split(" ")[0],
                variant === "row" ? "opacity-0 group-hover:opacity-100" : "opacity-90",
              )}
            >
              <ChevronLeft className={variant === "row" ? "h-3.5 w-3.5" : "h-5 w-5"} />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); scrollNext(); }}
              aria-label="Next photo"
              className={cn(
                "absolute top-1/2 -translate-y-1/2 grid place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 transition-opacity",
                arrowSize,
                arrowInset.split(" ")[1],
                variant === "row" ? "opacity-0 group-hover:opacity-100" : "opacity-90",
              )}
            >
              <ChevronRight className={variant === "row" ? "h-3.5 w-3.5" : "h-5 w-5"} />
            </button>

            <PaginationDots
              count={images.length}
              current={current}
              onSelect={scrollTo}
              variant={variant}
            />

            <span className="absolute top-2 right-2 tabular-nums text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/50 text-white pointer-events-none">
              {current + 1}/{images.length}
            </span>
          </>
        )}
      </div>

      {variant === "hero" && images.length > 1 && (
        <div className="mt-3 flex gap-1.5 overflow-x-auto scrollbar-none">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => scrollTo(i)}
              className={cn(
                "shrink-0 h-16 w-20 rounded-md overflow-hidden border-2 transition-all",
                i === current ? "border-primary" : "border-transparent opacity-60 hover:opacity-100",
              )}
              aria-label={`Jump to photo ${i + 1}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}

      {lightbox !== null && (
        <Lightbox
          images={images}
          index={lightbox}
          title={title}
          onClose={() => setLightbox(null)}
          onChange={setLightbox}
        />
      )}
    </>
  );
}

function PaginationDots({
  count, current, onSelect, variant,
}: { count: number; current: number; onSelect: (i: number) => void; variant: Variant }) {
  // On row variant with lots of images the dots crowd — cap visible dots to 5 with an ellipsis feel.
  const maxDots = variant === "row" ? 5 : 10;
  const compressed = count > maxDots;

  return (
    <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1 pointer-events-none">
      {(compressed ? Array.from({ length: maxDots }) : Array.from({ length: count })).map((_, i) => {
        const active = compressed
          ? Math.round((current / (count - 1)) * (maxDots - 1)) === i
          : current === i;
        return (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(compressed ? Math.round((i / (maxDots - 1)) * (count - 1)) : i);
            }}
            aria-label={`Go to slide ${i + 1}`}
            className={cn(
              "pointer-events-auto rounded-full transition-all",
              variant === "row" ? "h-1 w-1" : "h-1.5 w-1.5",
              active ? "bg-white w-4" : "bg-white/60 hover:bg-white/90",
            )}
          />
        );
      })}
    </div>
  );
}

function StaticThumb({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-muted">
      <img src={src} alt={alt} className="w-full h-full object-cover" loading="lazy" draggable={false} />
    </div>
  );
}

function Lightbox({
  images, index, title, onClose, onChange,
}: {
  images: string[]; index: number; title?: string;
  onClose: () => void; onChange: (i: number) => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onChange(index - 1);
      if (e.key === "ArrowRight" && index < images.length - 1) onChange(index + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [index, images.length, onClose, onChange]);

  return (
    <div className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20 transition-colors"
      >
        <X className="h-5 w-5" />
      </button>

      <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
        {index + 1} / {images.length}
      </p>

      {index > 0 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(index - 1); }}
          aria-label="Previous photo"
          className="absolute left-4 h-10 w-10 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      <img
        src={images[index]}
        alt={`${title ?? "Photo"} ${index + 1}`}
        className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />

      {index < images.length - 1 && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onChange(index + 1); }}
          aria-label="Next photo"
          className="absolute right-4 h-10 w-10 rounded-full bg-white/10 text-white grid place-items-center hover:bg-white/20 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto py-1">
          {images.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(i); }}
              className={cn(
                "shrink-0 h-12 w-12 rounded-md overflow-hidden border-2 transition-colors",
                i === index ? "border-white" : "border-white/30 opacity-60 hover:opacity-90",
              )}
              aria-label={`Jump to photo ${i + 1}`}
            >
              <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
