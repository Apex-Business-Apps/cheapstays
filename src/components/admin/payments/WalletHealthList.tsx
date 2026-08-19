import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPHP, splitEarnings } from "@/lib/money";

type StuckRow = {
  bookingId: string;
  hostName: string;
  gross: number;
  host: number;
  payoutReleaseOn: string;
  daysOverdue: number;
  reason: "no_credit" | "not_released";
};

const STUCK_WINDOW_DAYS = 3;

async function loadHealth(): Promise<StuckRow[]> {
  const cutoff = new Date(Date.now() - STUCK_WINDOW_DAYS * 86_400_000).toISOString();

  const bookRes = await supabase
    .from("bookings")
    .select("id,host_id,total_php,payout_release_on")
    .eq("payment_status", "paid")
    .lt("payout_release_on", cutoff)
    .order("payout_release_on", { ascending: true })
    .limit(100);

  const bookings = (bookRes.data ?? []) as unknown as Array<{
    id: string; host_id: string; total_php: number | string; payout_release_on: string;
  }>;
  if (bookings.length === 0) return [];

  const bookingIds = bookings.map((b) => b.id);
  const hostIds = Array.from(new Set(bookings.map((b) => b.host_id)));

  const [txRes, profRes] = await Promise.all([
    supabase
      .from("wallet_transactions")
      .select("booking_id,type,status")
      .in("booking_id", bookingIds)
      .eq("status", "completed"),
    supabase.from("profiles").select("user_id,display_name").in("user_id", hostIds),
  ]);

  const stageMap = new Map<string, "credited" | "released">();
  for (const t of txRes.data ?? []) {
    if (!t.booking_id) continue;
    if (t.type === "release_to_available") stageMap.set(t.booking_id, "released");
    else if (t.type === "credit_pending" && stageMap.get(t.booking_id) !== "released") stageMap.set(t.booking_id, "credited");
  }

  const nameMap = new Map<string, string>();
  for (const p of profRes.data ?? []) if (p.display_name) nameMap.set(p.user_id, p.display_name);

  const now = Date.now();
  return bookings
    .filter((b) => stageMap.get(b.id) !== "released") // healthy rows already released — skip
    .map((b) => {
      const gross = Number(b.total_php ?? 0);
      const { host } = splitEarnings(gross);
      const stage = stageMap.get(b.id);
      return {
        bookingId: b.id,
        hostName: nameMap.get(b.host_id) ?? `Host #${b.host_id.slice(0, 6)}`,
        gross,
        host,
        payoutReleaseOn: b.payout_release_on,
        daysOverdue: Math.floor((now - new Date(b.payout_release_on).getTime()) / 86_400_000),
        reason: stage === "credited" ? "not_released" : "no_credit",
      };
    });
}

export function WalletHealthList() {
  const [rows, setRows] = useState<StuckRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHealth().then((r) => { if (!cancelled) setRows(r); }).catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Wallet health</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Paid bookings past their <span className="font-medium text-foreground">payout release date</span> that
            haven&apos;t reached the host&apos;s available balance yet.
          </p>
        </div>
      </div>

      {!rows ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All paid bookings past their release date have been credited and moved to available.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
          {rows.map((r) => (
            <li key={r.bookingId} className="px-4 py-3 flex items-center gap-3">
              <span className="grid place-items-center h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 shrink-0">
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-foreground truncate">
                  <span className="font-medium">{r.hostName}</span>
                  <span className="text-muted-foreground"> · booking #{r.bookingId.slice(0, 8)}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {r.reason === "no_credit"
                    ? "Never credited to pending balance — reconcile job will catch this."
                    : "Credited but still pending — release sweep will move it tonight."}
                  {" · "}
                  {r.daysOverdue}d overdue
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-medium tabular-nums text-foreground">{formatPHP(r.host)}</div>
                <div className="text-[11px] text-muted-foreground">of {formatPHP(r.gross)} gross</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
