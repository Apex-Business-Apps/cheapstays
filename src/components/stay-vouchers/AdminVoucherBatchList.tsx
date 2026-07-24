import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  id: string; batch_name: string; nights: number; price_php: number;
  quantity: number; valid_days: number; is_active: boolean;
  listing: { title: string };
  sold_count: number;
};

export function AdminVoucherBatchList({ reloadKey }: { reloadKey: number }) {
  const [rows, setRows] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    const { data: bs } = await supabase.from("stay_voucher_batches")
      .select("id, batch_name, nights, price_php, quantity, valid_days, is_active, listing:listings(title)")
      .order("created_at", { ascending: false });
    const ids = (bs ?? []).map((b) => b.id);
    let counts = new Map<string, number>();
    if (ids.length) {
      const { data: cs } = await supabase.from("stay_voucher_codes")
        .select("batch_id").in("batch_id", ids);
      counts = (cs ?? []).reduce((m, r) => m.set(r.batch_id, (m.get(r.batch_id) ?? 0) + 1), new Map<string, number>());
    }
    setRows((bs ?? []).map((b) => ({
      ...b,
      listing: Array.isArray(b.listing) ? b.listing[0] : b.listing,
      sold_count: counts.get(b.id) ?? 0,
    })) as Row[]);
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  const deactivate = async (id: string) => {
    const { error } = await supabase.functions.invoke("admin-stay-voucher-batch-deactivate", { body: { batch_id: id } });
    if (error) { toast.error(error.message); return; }
    toast.success("Deactivated.");
    load();
  };

  if (rows === null) return <Skeleton className="h-40" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No batches yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground text-left">
          <tr>
            <th className="py-2">Listing</th><th>Batch</th><th>Price</th><th>Nights</th>
            <th>Sold / Qty</th><th>Valid</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="py-2 truncate max-w-[200px]">{r.listing?.title}</td>
              <td>{r.batch_name}</td>
              <td>₱{r.price_php.toLocaleString()}</td>
              <td>{r.nights}</td>
              <td>{r.sold_count} / {r.quantity}</td>
              <td>{r.valid_days}d</td>
              <td>
                <Badge variant={r.is_active ? "default" : "secondary"}>
                  {r.is_active ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="text-right">
                {r.is_active && (
                  <Button variant="ghost" size="sm" onClick={() => deactivate(r.id)} className="min-h-[44px]">
                    Deactivate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
