import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import { Seo } from "@/components/Seo";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPHP } from "@/lib/money";
import { loadWalletHealth, type StuckRow } from "@/components/admin/payments/walletHealthLoader";

export default function WalletHealthPage() {
  const [rows, setRows] = useState<StuckRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await loadWalletHealth();
      setRows(r);
    } catch {
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    loadWalletHealth().then((r) => { if (!cancelled) setRows(r); }).catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <Seo title="Wallet health · CheapStays Admin" description="Every paid booking past its release date that hasn't been credited to the host's available balance." path="/admin/payments/wallet-health" />

      <header className="mb-6">
        <Link to="/admin/payments" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-2">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Payments
        </Link>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Wallet health</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Every paid booking past its <span className="font-medium text-foreground">payout release date</span> that
              hasn&apos;t reached the host&apos;s available balance yet.
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </header>

      <Card className="p-5">
        {!rows ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
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
                    {r.daysOverdue}d overdue · release on {new Date(r.payoutReleaseOn).toLocaleDateString("en-PH")}
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
    </>
  );
}
