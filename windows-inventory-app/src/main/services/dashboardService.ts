import { getDb, todayIso } from "../db/database";
import { getCurrentBalance, periodBounds } from "./stockService";
import { listAuditLog } from "./auditService";
import { milliToQuantity } from "../../shared/money";
import type { ActivityEntry, DashboardStats, Product, Unit } from "../../shared/types";

const ACTION_TYPE_MAP: Record<string, ActivityEntry["type"]> = {
  invoice: "receiving",
  stock_out: "stock_out",
  product: "product",
  period: "period_closed",
  backup: "backup",
  restore: "restore",
};

export function getDashboardStats(): DashboardStats {
  const db = getDb();
  const today = todayIso();
  const [year, month] = today.split("-").map(Number);
  const { start, endExclusive } = periodBounds(year, month);

  const products = db
    .prepare("SELECT id, unit, sale_price_cents as salePriceCents FROM products WHERE is_active = 1")
    .all() as Pick<Product, "id" | "unit" | "salePriceCents">[];

  const totalStockQtyByUnit: Partial<Record<Unit, number>> = {};
  let stockValuationCents = 0;
  for (const p of products) {
    const balanceMilli = getCurrentBalance(p.id, db);
    totalStockQtyByUnit[p.unit] = (totalStockQtyByUnit[p.unit] ?? 0) + milliToQuantity(balanceMilli);
    stockValuationCents += Math.round((balanceMilli * p.salePriceCents) / 1000);
  }

  const receivedRow = db
    .prepare(
      `SELECT COALESCE(SUM(ii.quantity_milli * ii.invoice_price_cents / 1000.0), 0) AS total
       FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
       WHERE i.period_year = ? AND i.period_month = ?`
    )
    .get(year, month) as { total: number };

  const issuedRows = db
    .prepare(
      `SELECT p.unit AS unit, COALESCE(SUM(so.quantity_milli), 0) AS totalMilli
       FROM stock_outs so JOIN products p ON p.id = so.product_id
       WHERE so.movement_date >= ? AND so.movement_date < ?
       GROUP BY p.unit`
    )
    .all(start, endExclusive) as { unit: Unit; totalMilli: number }[];
  const issuedQtyThisMonthByUnit: Partial<Record<Unit, number>> = {};
  for (const r of issuedRows) issuedQtyThisMonthByUnit[r.unit] = milliToQuantity(r.totalMilli);

  const totalProductsRow = db.prepare("SELECT COUNT(*) AS c FROM products WHERE is_active = 1").get() as {
    c: number;
  };

  const recentActivity: ActivityEntry[] = listAuditLog(15).map((entry) => ({
    id: entry.id,
    type: ACTION_TYPE_MAP[entry.entityType] ?? (entry.action.includes("delete") ? "delete" : "edit"),
    description: entry.description,
    createdAt: entry.createdAt,
  }));

  return {
    totalProducts: totalProductsRow.c,
    totalStockQtyByUnit,
    receivedValueThisMonthCents: Math.round(receivedRow.total),
    issuedQtyThisMonthByUnit,
    stockValuationCents,
    recentActivity,
  };
}
