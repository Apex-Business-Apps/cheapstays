import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPHP } from "@/lib/money";
import { loadWalletHealth, type StuckRow } from "./walletHealthLoader";

const PREVIEW_LIMIT = 2;

export function WalletHealthList() {
  const [rows, setRows] = useState<StuckRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadWalletHealth().then((r) => { if (!cancelled) setRows(r); }).catch(() => { if (!cancelled) setRows([]); });
    return () => { cancelled = true; };
  }, []);

  const visible = rows?.slice(0, PREVIEW_LIMIT) ?? [];
  const hiddenCount = rows ? Math.max(0, rows.length - PREVIEW_LIMIT) : 0;

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
          {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          All paid bookings past their release date have been credited and moved to available.
        </div>
      ) : (
        <>
          <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
            {visible.map((r) => (
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
          {hiddenCount > 0 && (
            <Link
              to="/admin/payments/wallet-health"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              See all {rows.length} stuck bookings
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </>
      )}
    </Card>
  );
}
