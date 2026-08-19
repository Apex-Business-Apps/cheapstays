import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPHP, splitEarnings } from "@/lib/money";

type WalletStage = "pending" | "available" | "disbursed" | "none";

type Row = {
  bookingId: string;
  paidAt: string | null;
  gross: number;
  fee: number;
  host: number;
  hostId: string;
  hostName: string;
  guestName: string;
  listingTitle: string;
  listingCity: string | null;
  paymentMethod: string | null;
  payoutReleaseOn: string | null;
  stage: WalletStage;
};

const STAGE_STYLE: Record<WalletStage, string> = {
  pending: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/20",
  available: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20",
  disbursed: "bg-blue-500/10 text-blue-700 dark:text-blue-400 ring-1 ring-blue-500/20",
  none: "bg-muted text-muted-foreground ring-1 ring-border",
};

const STAGE_LABEL: Record<WalletStage, string> = {
  pending: "Held (pending)",
  available: "Ready to disburse",
  disbursed: "Sent to host",
  none: "Not yet credited",
};

type LedgerFilter = "all" | "pending" | "available" | "disbursed" | "none";

const FILTERS: { key: LedgerFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "none", label: "Not credited" },
  { key: "pending", label: "Held" },
  { key: "available", label: "Ready" },
  { key: "disbursed", label: "Disbursed" },
];

async function loadLedger(): Promise<Row[]> {
  const bookRes = await supabase
    .from("bookings")
    .select("id,paid_at,total_php,host_id,guest_id,guest_name_snapshot,payment_method,payout_release_on,listings(title,city)")
    .eq("payment_status", "paid")
    .not("paid_at", "is", null)
    .order("paid_at", { ascending: false })
    .limit(50);

  const bookings = (bookRes.data ?? []) as unknown as Array<{
    id: string;
    paid_at: string | null;
    total_php: number | string;
    host_id: string;
    guest_id: string | null;
    guest_name_snapshot: string | null;
    payment_method: string | null;
    payout_release_on: string | null;
    listings: { title: string | null; city: string | null } | null;
  }>;

  if (bookings.length === 0) return [];

  const userIds = Array.from(new Set(bookings.flatMap((b) => [b.host_id, b.guest_id].filter(Boolean) as string[])));
  const bookingIds = bookings.map((b) => b.id);

  const [profileRes, txRes] = await Promise.all([
    supabase.from("profiles").select("user_id,display_name").in("user_id", userIds),
    supabase.from("wallet_transactions").select("booking_id,type,status").in("booking_id", bookingIds),
  ]);

  const nameMap = new Map<string, string>();
  for (const p of profileRes.data ?? []) {
    if (p.user_id && p.display_name) nameMap.set(p.user_id, p.display_name);
  }

  const stageMap = new Map<string, WalletStage>();
  for (const t of txRes.data ?? []) {
    if (!t.booking_id || t.status !== "completed") continue;
    const prev = stageMap.get(t.booking_id) ?? "none";
    // Priority: disbursed > available > pending > none
    if (t.type === "debit_disbursement") stageMap.set(t.booking_id, "disbursed");
    else if (t.type === "release_to_available" && prev !== "disbursed") stageMap.set(t.booking_id, "available");
    else if (t.type === "credit_pending" && prev === "none") stageMap.set(t.booking_id, "pending");
  }

  return bookings.map((b) => {
    const gross = Number(b.total_php ?? 0);
    const { fee, host } = splitEarnings(gross);
    return {
      bookingId: b.id,
      paidAt: b.paid_at,
      gross,
      fee,
      host,
      hostId: b.host_id,
      hostName: nameMap.get(b.host_id) ?? shortId(b.host_id),
      guestName: b.guest_name_snapshot ?? (b.guest_id ? (nameMap.get(b.guest_id) ?? shortId(b.guest_id)) : "Guest"),
      listingTitle: b.listings?.title ?? "—",
      listingCity: b.listings?.city ?? null,
      paymentMethod: b.payment_method,
      payoutReleaseOn: b.payout_release_on,
      stage: stageMap.get(b.id) ?? "none",
    };
  });
}

function shortId(id: string) { return `#${id.slice(0, 6)}`; }

function formatShortDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export function PaymentsLedgerTable() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const [q, setQ] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setRows(await loadLedger());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const filtered = (rows ?? []).filter((r) => {
    if (filter !== "all" && r.stage !== filter) return false;
    if (q) {
      const needle = q.toLowerCase();
      if (!r.guestName.toLowerCase().includes(needle)
        && !r.hostName.toLowerCase().includes(needle)
        && !r.listingTitle.toLowerCase().includes(needle)) return false;
    }
    return true;
  });

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Payment ledger</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Latest 50 paid bookings and where the money sits.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search guest, host, listing"
              className="pl-8 pr-3 h-8 rounded-md border border-input bg-background text-xs w-56 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="h-8 w-8 grid place-items-center rounded-md border border-input hover:bg-muted"
            aria-label="Refresh ledger"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-3 pb-2 flex gap-1.5 flex-wrap border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
              filter === f.key
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {!rows ? (
        <div className="p-5 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">
          Nothing matches. Try clearing the filters.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-5 py-2.5">Paid</th>
                <th className="px-3 py-2.5">Guest → Host</th>
                <th className="px-3 py-2.5">Listing</th>
                <th className="px-3 py-2.5 text-right">Gross</th>
                <th className="px-3 py-2.5 text-right">Fee</th>
                <th className="px-3 py-2.5 text-right">Host earns</th>
                <th className="px-3 py-2.5">Release on</th>
                <th className="px-5 py-2.5">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((r) => (
                <tr key={r.bookingId} className="hover:bg-muted/40 transition-colors">
                  <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {formatShortDate(r.paidAt)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-foreground truncate max-w-[180px]">{r.guestName}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[180px]">→ {r.hostName}</div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-sm text-foreground truncate max-w-[220px]">{r.listingTitle}</div>
                    {r.listingCity && <div className="text-xs text-muted-foreground">{r.listingCity}</div>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-sm text-foreground">{formatPHP(r.gross)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatPHP(r.fee)}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-sm font-medium text-foreground">{formatPHP(r.host)}</td>
                  <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatShortDate(r.payoutReleaseOn)}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${STAGE_STYLE[r.stage]}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
                      {STAGE_LABEL[r.stage]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
