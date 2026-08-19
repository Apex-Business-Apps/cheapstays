import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatPHPCompact, formatPHP } from "@/lib/money";

type DayRow = { day: string; label: string; gross: number; released: number; disbursed: number };

const DAYS = 30;

function buildEmpty(): DayRow[] {
  const rows: DayRow[] = [];
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    rows.push({
      day: iso,
      label: d.toLocaleDateString("en-PH", { month: "short", day: "numeric" }),
      gross: 0,
      released: 0,
      disbursed: 0,
    });
  }
  return rows;
}

export function PaymentsFlowChart() {
  const [rows, setRows] = useState<DayRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();

    Promise.all([
      supabase.from("bookings").select("paid_at,total_php").eq("payment_status", "paid").gte("paid_at", since),
      supabase.from("wallet_transactions").select("created_at,type,amount,status").in("type", ["release_to_available", "debit_disbursement"]).gte("created_at", since),
    ]).then(([bookRes, txRes]) => {
      if (cancelled) return;
      const base = buildEmpty();
      const idx = new Map(base.map((r, i) => [r.day, i]));

      const bookings = (bookRes.data ?? []) as unknown as Array<{ paid_at: string | null; total_php: number | string | null }>;
      const txs = (txRes.data ?? []) as unknown as Array<{ created_at: string; type: string; amount: number | string | null; status: string }>;

      for (const b of bookings) {
        if (!b.paid_at) continue;
        const key = String(b.paid_at).slice(0, 10);
        const i = idx.get(key);
        if (i !== undefined) base[i].gross += Number(b.total_php ?? 0);
      }
      for (const t of txs) {
        if (t.status !== "completed") continue;
        const key = String(t.created_at).slice(0, 10);
        const i = idx.get(key);
        if (i === undefined) continue;
        if (t.type === "release_to_available") base[i].released += Number(t.amount ?? 0);
        if (t.type === "debit_disbursement") base[i].disbursed += Number(t.amount ?? 0);
      }
      setRows(base);
    }).catch(() => { if (!cancelled) setRows(buildEmpty()); });

    return () => { cancelled = true; };
  }, []);

  const hasData = useMemo(() => (rows ?? []).some(r => r.gross || r.released || r.disbursed), [rows]);

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Money flow · last 30 days</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Gross in, released to hosts, disbursed off-platform.</p>
        </div>
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <LegendDot className="bg-emerald-500" label="Gross in" />
          <LegendDot className="bg-amber-500" label="Released" />
          <LegendDot className="bg-blue-500" label="Disbursed" />
        </div>
      </div>

      {!rows ? (
        <Skeleton className="h-56 w-full rounded-md" />
      ) : !hasData ? (
        <div className="h-56 grid place-items-center text-sm text-muted-foreground">
          No payment activity in the last 30 days.
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(160 84% 39%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(160 84% 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="relGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38 92% 50%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(38 92% 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="disbGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="2 4" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} minTickGap={24} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={48} tickFormatter={(v) => formatPHPCompact(v)} />
              <Tooltip
                cursor={{ stroke: "hsl(var(--border))" }}
                contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                formatter={(v: number, name) => [formatPHP(v), name]}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area type="monotone" dataKey="gross" name="Gross in" stroke="hsl(160 84% 39%)" strokeWidth={2} fill="url(#grossGrad)" />
              <Area type="monotone" dataKey="released" name="Released" stroke="hsl(38 92% 50%)" strokeWidth={2} fill="url(#relGrad)" />
              <Area type="monotone" dataKey="disbursed" name="Disbursed" stroke="hsl(217 91% 60%)" strokeWidth={2} fill="url(#disbGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
      <span className={`inline-block h-2 w-2 rounded-full ${className}`} />
      {label}
    </span>
  );
}
