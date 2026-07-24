import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, ArrowRight } from "lucide-react";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";

export function VoucherCard({ batch }: { batch: StayVoucherBatchWithListing }) {
  const soldOut = batch.unclaimed_count >= batch.quantity;
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
        <p className="text-lg font-semibold">₱{batch.price_php.toLocaleString()}</p>
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
