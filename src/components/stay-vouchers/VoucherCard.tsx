import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";

export function VoucherCard({ batch }: { batch: StayVoucherBatchWithListing }) {
  const soldOut = batch.sold_count >= batch.quantity;
  const orig = batch.listing.nightly_php ? batch.listing.nightly_php * batch.nights : null;
  const discounted = orig !== null && orig > batch.price_php;
  const pctOff = discounted && orig
    ? Math.round(((orig - batch.price_php) / orig) * 100)
    : 0;
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-secondary/40 relative">
        {batch.listing.hero_image_url && (
          <img src={batch.listing.hero_image_url} alt={batch.listing.title}
               className="h-full w-full object-cover" loading="lazy" />
        )}
        <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">
          {batch.nights} night{batch.nights === 1 ? "" : "s"}
        </Badge>
        {discounted && !soldOut && (
          <Badge className="absolute top-2 right-2 text-[10px] bg-primary text-primary-foreground">
            −{pctOff}%
          </Badge>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">Sold out</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-1.5">
        <p className="text-sm font-medium truncate">{batch.listing.title}</p>
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" /> {batch.listing.city ?? "PH"}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-lg font-semibold">₱{batch.price_php.toLocaleString()}</p>
          {discounted && orig && (
            <p className="text-xs text-muted-foreground line-through">
              ₱{orig.toLocaleString()}
            </p>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> Valid {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"}
        </p>
        <Link
          to={`/stay-vouchers/${batch.id}`}
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 pt-1"
        >
          {soldOut ? "View details" : "Buy voucher"} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </Card>
  );
}
