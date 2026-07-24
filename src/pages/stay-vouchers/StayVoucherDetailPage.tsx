import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VoucherPurchaseForm } from "@/components/stay-vouchers/VoucherPurchaseForm";

type BatchRow = {
  id: string; batch_name: string; nights: number; price_php: number;
  valid_days: number; terms: string | null; is_active: boolean;
  listing: { id: string; title: string; city: string | null; description: string | null; images: string[] | null };
};

export default function StayVoucherDetailPage() {
  const { batchId } = useParams();
  const [batch, setBatch] = useState<BatchRow | null | undefined>(undefined);

  useEffect(() => {
    if (!batchId) return;
    (async () => {
      const { data } = await supabase
        .from("stay_voucher_batches")
        .select(`
          id, batch_name, nights, price_php, valid_days, terms, is_active,
          listing:listings(id, title, city, description, images)
        `)
        .eq("id", batchId).maybeSingle();
      if (!data) { setBatch(null); return; }
      const l = Array.isArray(data.listing) ? data.listing[0] : data.listing;
      setBatch({ ...data, listing: l } as BatchRow);
    })();
  }, [batchId]);

  if (batch === undefined) return <div className="p-8"><Skeleton className="h-40" /></div>;
  if (batch === null || !batch.is_active) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-lg">
        <h1 className="text-xl font-semibold mb-2">Voucher not available</h1>
        <p className="text-sm text-muted-foreground mb-4">This deal is no longer active.</p>
        <Link to="/stay-vouchers" className="text-sm text-primary hover:underline">Browse other vouchers</Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Seo title={`${batch.batch_name} · CheapStays`} description={`Voucher deal for ${batch.listing.title}`} path={`/stay-vouchers/${batch.id}`} />
      <Link to="/stay-vouchers" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3 w-3" /> All vouchers
      </Link>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          {batch.listing.images?.[0] && (
            <img src={batch.listing.images[0]} alt={batch.listing.title}
                 className="w-full rounded-md object-cover aspect-[4/3]" />
          )}
          <h1 className="text-xl font-semibold">{batch.listing.title}</h1>
          <p className="text-sm text-muted-foreground">{batch.listing.city}</p>
          {batch.listing.description && (
            <p className="text-sm">{batch.listing.description}</p>
          )}
        </div>
        <Card className="p-5 space-y-3 h-fit">
          <div>
            <p className="text-xs text-muted-foreground">{batch.batch_name}</p>
            <p className="text-3xl font-semibold">₱{batch.price_php.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">
              {batch.nights} night{batch.nights === 1 ? "" : "s"} · one voucher
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Redeem within {batch.valid_days} day{batch.valid_days === 1 ? "" : "s"} of purchase.
          </p>
          {batch.terms && <p className="text-[11px] text-muted-foreground">{batch.terms}</p>}
          <VoucherPurchaseForm batch={{
            id: batch.id, batch_name: batch.batch_name, nights: batch.nights,
            price_php: batch.price_php, valid_days: batch.valid_days,
            listing_title: batch.listing.title,
          }} />
        </Card>
      </div>
    </div>
  );
}
