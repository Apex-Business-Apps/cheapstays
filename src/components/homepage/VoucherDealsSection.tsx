import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StayVoucherBatchWithListing } from "@/types/stay-vouchers";
import { VoucherCard } from "@/components/stay-vouchers/VoucherCard";
import { AtmosphericSection } from "@/components/AtmosphericSection";

export function VoucherDealsSection() {
  const [batches, setBatches] = useState<StayVoucherBatchWithListing[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("stay_voucher_batches")
        .select(`
          id, listing_id, batch_name, nights, price_php, quantity, valid_days,
          terms, is_active, created_by, created_at,
          listing:listings(id, title, city, nightly_php, images)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(6);
      const batchIds = (data ?? []).map((b) => b.id);
      const soldMap = new Map<string, number>();
      if (batchIds.length > 0) {
        const { data: stock } = await supabase.rpc("get_stay_voucher_batch_stock", { p_batch_ids: batchIds });
        for (const row of (stock ?? []) as { batch_id: string; sold_or_held: number }[]) {
          soldMap.set(row.batch_id, row.sold_or_held);
        }
      }
      const rows = (data ?? []).map((b) => {
        const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
        return {
          ...b,
          listing: {
            id: l?.id, title: l?.title, city: l?.city ?? null,
            nightly_php: l?.nightly_php ?? null,
            hero_image_url: Array.isArray(l?.images) ? l!.images[0] ?? null : null,
          },
          sold_count: soldMap.get(b.id) ?? 0,
        } as unknown as StayVoucherBatchWithListing;
      });
      setBatches(rows);
    })();
  }, []);

  return (
    <AtmosphericSection as="section" variant="interior" parallaxStrength="subtle">
      <div className="py-10 px-4 max-w-6xl mx-auto">
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold">Voucher deals</h2>
            <p className="text-sm text-muted-foreground">Prepaid stays at discounted prices.</p>
          </div>
          <Link to="/stay-vouchers" className="text-xs text-primary hover:underline flex items-center gap-1">
            See all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {batches.length === 0 ? (
          <Link
            to="/stay-vouchers"
            className="block rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors"
          >
            New voucher deals arrive weekly. Tap to see what's live now →
          </Link>
        ) : (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {batches.slice(0, 4).map((b) => <VoucherCard key={b.id} batch={b} />)}
          </div>
        )}
      </div>
    </AtmosphericSection>
  );
}
