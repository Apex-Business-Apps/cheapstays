import { useEffect, useState } from "react";
import { Seo } from "@/components/Seo";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";
import { VoucherCard } from "@/components/stay-vouchers/VoucherCard";

export default function StayVouchersIndex() {
  const [batches, setBatches] = useState<StayVoucherBatchWithListing[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("stay_voucher_batches")
        .select(`
          id, listing_id, batch_name, nights, price_php, quantity, valid_days,
          terms, is_active, created_by, created_at,
          listing:listings(id, title, city, hero_image_url:images)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      const rows = (data ?? []).map((b) => {
        const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
        return {
          ...b,
          listing: { id: l?.id, title: l?.title, city: l?.city ?? null,
                     hero_image_url: Array.isArray(l?.hero_image_url) ? l!.hero_image_url[0] ?? null : null },
          unclaimed_count: 0,
        } as unknown as StayVoucherBatchWithListing;
      });
      setBatches(rows);
    })();
  }, []);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Seo title="Voucher deals · CheapStays" description="Prepaid stay vouchers." path="/stay-vouchers" />
      <h1 className="text-2xl font-semibold mb-1">Voucher deals</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Prepaid overnight stays at discounted prices. Redeem with the host at check-in.
      </p>
      {batches === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : batches.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No voucher deals right now — check back soon.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {batches.map((b) => <VoucherCard key={b.id} batch={b} />)}
        </div>
      )}
    </div>
  );
}
