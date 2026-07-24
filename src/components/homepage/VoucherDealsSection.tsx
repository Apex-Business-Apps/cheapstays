import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";
import { VoucherCard } from "@/components/stay-vouchers/VoucherCard";

export function VoucherDealsSection() {
  const [batches, setBatches] = useState<StayVoucherBatchWithListing[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stay_voucher_batches")
        .select(`
          id, listing_id, batch_name, nights, price_php, quantity, valid_days,
          terms, is_active, created_by, created_at,
          listing:listings(id, title, city, images)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      const rows = (data ?? []).map((b) => {
        const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
        return {
          ...b,
          listing: { id: l?.id, title: l?.title, city: l?.city ?? null,
                     hero_image_url: Array.isArray(l?.images) ? l!.images[0] ?? null : null },
          unclaimed_count: 0,
        } as unknown as StayVoucherBatchWithListing;
      });
      setBatches(rows);
    })();
  }, []);

  if (batches.length === 0) return null;

  return (
    <section className="py-10 px-4 max-w-6xl mx-auto">
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold">Voucher deals</h2>
          <p className="text-sm text-muted-foreground">Prepaid stays at discounted prices.</p>
        </div>
        <Link to="/stay-vouchers" className="text-xs text-primary hover:underline flex items-center gap-1">
          See all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {batches.slice(0, 4).map((b) => <VoucherCard key={b.id} batch={b} />)}
      </div>
    </section>
  );
}
