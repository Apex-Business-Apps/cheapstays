import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { useToast } from "../components/Toast";
import { formatMoneyBGN } from "../../shared/money";
import type { DashboardStats } from "../../shared/types";
import type { PageKey } from "../App";

function formatQtyByUnit(byUnit: Partial<Record<"kg" | "pcs", number>>): string {
  const parts: string[] = [];
  if (byUnit.kg) parts.push(`${byUnit.kg.toLocaleString("bg-BG", { maximumFractionDigits: 2 })} кг.`);
  if (byUnit.pcs) parts.push(`${byUnit.pcs.toLocaleString("bg-BG", { maximumFractionDigits: 0 })} бр.`);
  return parts.length ? parts.join(" / ") : "0";
}

const ACTIVITY_ICON: Record<string, string> = {
  receiving: "🧾",
  stock_out: "📤",
  edit: "✏️",
  delete: "🗑️",
  period_closed: "📅",
  backup: "💾",
  restore: "♻️",
  product: "📦",
};

export default function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const { show } = useToast();

  useEffect(() => {
    let cancelled = false;
    api.dashboard
      .stats()
      .then((s) => !cancelled && setStats(s))
      .catch((err) => show(errorMessage(err), "error"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stats) return <div className="text-muted">Зареждане…</div>;

  return (
    <div>
      <div className="stat-grid">
        <StatCard label="Общо продукти" value={stats.totalProducts} icon="📦" />
        <StatCard label="Обща наличност" value={formatQtyByUnit(stats.totalStockQtyByUnit)} icon="🗃️" />
        <StatCard
          label="Получени стоки този месец"
          value={formatMoneyBGN(stats.receivedValueThisMonthCents)}
          icon="🧾"
        />
        <StatCard label="Изходящи стоки този месец" value={formatQtyByUnit(stats.issuedQtyThisMonthByUnit)} icon="📤" />
        <StatCard label="Стойност на наличностите" value={formatMoneyBGN(stats.stockValuationCents)} icon="💰" />
      </div>

      <div className="field-row" style={{ marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => onNavigate("receiving")}>
          🧾 Нова фактура
        </button>
        <button className="btn" onClick={() => onNavigate("stockOut")}>
          📤 Ново изписване
        </button>
        <button className="btn" onClick={() => onNavigate("products")}>
          📦 Нов продукт
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Последни операции</h3>
        {stats.recentActivity.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🕊️</div>
            Все още няма записани операции.
          </div>
        ) : (
          <div className="activity-list">
            {stats.recentActivity.map((entry) => (
              <div className="activity-item" key={entry.id}>
                <span className="dot" />
                <div>
                  <div className="desc">
                    {ACTIVITY_ICON[entry.type] ?? "•"} {entry.description}
                  </div>
                  <div className="time">{new Date(entry.createdAt).toLocaleString("bg-BG")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
