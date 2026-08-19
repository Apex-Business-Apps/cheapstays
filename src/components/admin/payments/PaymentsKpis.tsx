import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Wallet, Coins } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatPHP, PLATFORM_FEE_RATE } from "@/lib/money";

type Kpis = {
  grossLast30: number;
  feeLast30: number;
  heldTotal: number;
  disbursedLast30: number;
};

const iso30dAgo = () => new Date(Date.now() - 30 * 86_400_000).toISOString();

async function loadKpis(): Promise<Kpis> {
  const since = iso30dAgo();

  const [paidRes, walletRes, disburseRes] = await Promise.all([
    supabase
      .from("bookings")
      .select("total_php")
      .eq("payment_status", "paid")
      .gte("paid_at", since),
    supabase
      .from("host_wallets")
      .select("pending_balance,available_balance"),
    supabase
      .from("wallet_transactions")
      .select("amount")
      .eq("type", "debit_disbursement")
      .eq("status", "completed")
      .gte("created_at", since),
  ]);

  const paidRows = (paidRes.data ?? []) as unknown as Array<{ total_php: number | string | null }>;
  const walletRows = (walletRes.data ?? []) as unknown as Array<{ pending_balance: number | string | null; available_balance: number | string | null }>;
  const disburseRows = (disburseRes.data ?? []) as unknown as Array<{ amount: number | string | null }>;

  const gross = paidRows.reduce((s, b) => s + Number(b.total_php ?? 0), 0);
  const held = walletRows.reduce(
    (s, w) => s + Number(w.pending_balance ?? 0) + Number(w.available_balance ?? 0),
    0,
  );
  const disbursed = disburseRows.reduce((s, t) => s + Number(t.amount ?? 0), 0);

  return {
    grossLast30: gross,
    feeLast30: gross * PLATFORM_FEE_RATE,
    heldTotal: held,
    disbursedLast30: disbursed,
  };
}

export function PaymentsKpis() {
  const [kpis, setKpis] = useState<Kpis | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKpis().then((k) => { if (!cancelled) setKpis(k); }).catch(() => { if (!cancelled) setKpis({ grossLast30: 0, feeLast30: 0, heldTotal: 0, disbursedLast30: 0 }); });
    return () => { cancelled = true; };
  }, []);

  if (!kpis) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5 space-y-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  const items = [
    {
      label: "Gross collected · 30d",
      value: kpis.grossLast30,
      hint: "PayMongo paid bookings",
      icon: ArrowDownRight,
      tone: "text-emerald-600",
    },
    {
      label: "Platform fees · 30d",
      value: kpis.feeLast30,
      hint: `${(PLATFORM_FEE_RATE * 100).toFixed(0)}% of gross`,
      icon: Coins,
      tone: "text-primary",
    },
    {
      label: "Held for hosts",
      value: kpis.heldTotal,
      hint: "Pending + available",
      icon: Wallet,
      tone: "text-amber-600",
    },
    {
      label: "Disbursed · 30d",
      value: kpis.disbursedLast30,
      hint: "Sent off-platform",
      icon: ArrowUpRight,
      tone: "text-blue-600",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Card key={it.label} className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium tracking-wide uppercase text-muted-foreground">
              {it.label}
            </p>
            <it.icon className={`h-4 w-4 ${it.tone}`} aria-hidden="true" />
          </div>
          <p className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
            {formatPHP(it.value)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{it.hint}</p>
        </Card>
      ))}
    </div>
  );
}
