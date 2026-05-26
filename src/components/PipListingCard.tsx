import { useState } from "react";
import { Star, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchListing } from "@/types/pip";
import { getListingPrimaryImage, getListingImageAlt } from "@/lib/listings";

type Props = {
  listing: SearchListing;
  onBook: (listing: SearchListing) => void;
};

export function PipListingCard({ listing, onBook }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [imageFailed, setImageFailed] = useState(false);
  const img = getListingPrimaryImage(listing);
  const altText = getListingImageAlt(listing);
  const navTarget = listing.slug ? `/listing/${listing.slug}` : `/listing/${listing.id}`;

  return (
    <div className="rounded-xl border border-border/50 bg-background/80 overflow-hidden shadow-sm w-full">
      {/* Thumbnail */}
      {img && !imageFailed ? (
        <div className="h-28 w-full overflow-hidden bg-secondary/40">
          <img
            src={img}
            alt={altText}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div className="h-28 w-full bg-gradient-to-br from-secondary/60 to-accent/10 flex items-center justify-center">
          <MapPin className="h-5 w-5 text-muted-foreground/50" />
        </div>
      )}

      <div className="p-2.5 space-y-1.5">
        {/* Badges row */}
        <div className="flex items-center gap-1 flex-wrap">
          {listing.avg_rating != null && listing.avg_rating > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500 font-medium">
              <Star className="h-2.5 w-2.5 fill-amber-400 text-amber-400" />
              {listing.avg_rating.toFixed(1)}
              {listing.review_count != null && listing.review_count > 0 && (
                <span className="text-muted-foreground font-normal">({listing.review_count})</span>
              )}
            </span>
          )}
        </div>

        {/* Title */}
        <p className="text-sm font-semibold leading-tight line-clamp-2">{listing.title}</p>

        {/* Location */}
        <p className="text-[11px] text-muted-foreground">
          {listing.city}, {listing.province}
        </p>

        {/* Details row */}
        <p className="text-[11px] text-muted-foreground">
          {listing.bedrooms}BR · max {listing.max_guests} guests · min {listing.min_nights} night{listing.min_nights !== 1 ? "s" : ""}
        </p>

        {/* Price */}
        <p className="text-sm font-bold text-primary">
          {t("pip.perNight", { price: listing.nightly_php.toLocaleString() })}
        </p>

        {/* AI deal reason */}
        {listing.why_its_a_deal && (
          <p className="text-[10px] text-muted-foreground italic leading-snug line-clamp-2">
            {listing.why_its_a_deal}
          </p>
        )}

        {/* CTAs */}
        <div className="flex gap-1.5 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-7 text-[11px] font-medium"
            onClick={() => navigate(navTarget)}
          >
            {t("pip.viewListing")}
          </Button>
          <Button
            size="sm"
            className="flex-1 h-7 text-[11px] font-medium"
            onClick={() => onBook(listing)}
          >
            {t("pip.bookThis")}
          </Button>
        </div>
      </div>
    </div>
  );
}
