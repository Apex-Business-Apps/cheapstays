import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string; buyer_name: string; buyer_email: string; buyer_phone: string;
  payment_status: string; created_at: string;
  batch: { batch_name: string; listing: { title: string } };
  codes: { code: string; status: string }[];
};

export function AdminVoucherPurchasesTable() {
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: ps } = await supabase.from("stay_voucher_purchases")
        .select(`
          id, buyer_name, buyer_email, buyer_phone, payment_status, created_at,
          batch:stay_voucher_batches(batch_name, listing:listings(title))
        `)
        .order("created_at", { ascending: false }).limit(200);
      const ids = (ps ?? []).map((p) => p.id);
      let codesByPurchase = new Map<string, { code: string; status: string }[]>();
      if (ids.length) {
        const { data: cs } = await supabase.from("stay_voucher_codes")
          .select("purchase_id, code, status").in("purchase_id", ids);
        codesByPurchase = (cs ?? []).reduce((m, r) => {
          const list = m.get(r.purchase_id) ?? [];
          list.push({ code: r.code, status: r.status });
          m.set(r.purchase_id, list);
          return m;
        }, new Map<string, { code: string; status: string }[]>());
      }
      setRows((ps ?? []).map((p) => {
        const batch = Array.isArray(p.batch) ? p.batch[0] : p.batch;
        return {
          ...p,
          batch: { ...batch, listing: Array.isArray(batch?.listing) ? batch.listing[0] : batch?.listing },
          codes: codesByPurchase.get(p.id) ?? [],
        } as Row;
      }));
    })();
  }, []);

  if (rows === null) return <Skeleton className="h-40" />;
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">No purchases yet.</p>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground text-left">
          <tr>
            <th className="py-2">Buyer</th><th>Email</th><th>Phone</th>
            <th>Listing</th><th>Batch</th><th>Codes</th>
            <th>Purchase</th><th>Bought</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t align-top">
              <td className="py-2">{r.buyer_name}</td>
              <td className="text-xs text-muted-foreground">{r.buyer_email}</td>
              <td className="text-xs text-muted-foreground">{r.buyer_phone}</td>
              <td className="truncate max-w-[200px]">{r.batch?.listing?.title}</td>
              <td>{r.batch?.batch_name}</td>
              <td className="space-y-0.5">
                {r.codes.map((c) => (
                  <div key={c.code} className="flex items-center gap-1 text-xs">
                    <span className="font-mono">{c.code}</span>
                    <Badge variant="outline" className="text-[10px] capitalize">{c.status}</Badge>
                  </div>
                ))}
              </td>
              <td>
                <Badge variant={r.payment_status === "paid" ? "default" : "secondary"} className="text-[10px] capitalize">
                  {r.payment_status}
                </Badge>
              </td>
              <td className="text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleString("en-PH")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
