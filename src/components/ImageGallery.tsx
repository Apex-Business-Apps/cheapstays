import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X, Grid2X2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  title?: string;
};

export function ImageGallery({ images, title }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  useEffect(() => {
    if (lightbox === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
      if (e.key === "ArrowLeft" && lightbox > 0) setLightbox(lightbox - 1);
      if (e.key === "ArrowRight" && lightbox < images.length - 1) setLightbox(lightbox + 1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lightbox, images.length]);

  if (images.length === 0) return null;

  const showSideThumbs = images.length >= 2;

  return (
    <>
      {/* Gallery grid */}
      <div className={cn("grid gap-2 rounded-2xl overflow-hidden", showSideThumbs ? "grid-cols-2" : "grid-cols-1")}>
        {/* Hero */}
        <div
          className={cn(
            "relative overflow-hidden cursor-pointer bg-muted group",
            showSideThumbs ? "row-span-2" : "",
          )}
          style={{ aspectRatio: showSideThumbs ? "4/3" : "16/7" }}
          onClick={() => setLightbox(0)}
        >
          <img
            src={images[0]}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
          {images.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(0); }}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 text-black text-xs font-medium shadow hover:bg-white transition-colors"
            >
              <Grid2X2 className="h-3.5 w-3.5" />
              Show all {images.length} photos
            </button>
          )}
        </div>

        {/* Side thumbnails (up to 4 shown, 2 per column) */}
        {showSideThumbs &&
          images.slice(1, 5).map((url, i) => {
            const idx = i + 1;
            const isLast = i === 3 && images.length > 5;
            return (
              <div
                key={url}
                className="relative overflow-hidden cursor-pointer bg-muted group"
                onClick={() => setLightbox(idx)}
              >
                <img
                  src={url}
                  alt={`${title ?? "Photo"} ${idx + 1}`}
                  className="w-full h-full object-cover aspect-square transition-transform duration-300 group-hover:scale-[1.03]"
                  loading="lazy"
                />
                {isLast && (
                  <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">+{images.length - 5} more</span>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Lightbox */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-[200] bg-black/92 flex items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 h-9 w-9 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Counter */}
          <p className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm tabular-nums">
            {lightbox + 1} / {images.length}
          </p>

          {/* Prev */}
          {lightbox > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox - 1); }}
              className="absolute left-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {/* Image */}
          <img
            src={images[lightbox]}
            alt={`${title ?? "Photo"} ${lightbox + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {lightbox < images.length - 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setLightbox(lightbox + 1); }}
              className="absolute right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
              aria-label="Next photo"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto py-1">
              {images.map((url, i) => (
                <button
                  key={url}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setLightbox(i); }}
                  className={cn(
                    "shrink-0 h-12 w-12 rounded-md overflow-hidden border-2 transition-colors",
                    i === lightbox ? "border-white" : "border-white/30 opacity-60 hover:opacity-90"
                  )}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
