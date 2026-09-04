import { getDb, nowIso } from "../db/database";
import { logAudit } from "./auditService";
import { getMonthlyInventoryReport } from "./stockService";
import type { Period, PeriodRef } from "../../shared/types";

const MONTH_NAMES_BG = [
  "Януари", "Февруари", "Март", "Април", "Май", "Юни",
  "Юли", "Август", "Септември", "Октомври", "Ноември", "Декември",
];

export function monthLabelBg(month: number): string {
  return MONTH_NAMES_BG[month - 1] ?? String(month);
}

interface PeriodRow {
  id: number;
  year: number;
  month: number;
  is_closed: number;
  closed_at: string | null;
}

function mapRow(r: PeriodRow): Period {
  return { id: r.id, year: r.year, month: r.month, isClosed: r.is_closed === 1, closedAt: r.closed_at };
}

export function ensurePeriod(ref: PeriodRef): Period {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM periods WHERE year = ? AND month = ?")
    .get(ref.year, ref.month) as PeriodRow | undefined;
  if (existing) return mapRow(existing);
  const result = db
    .prepare("INSERT INTO periods (year, month, is_closed, closed_at) VALUES (?, ?, 0, NULL)")
    .run(ref.year, ref.month);
  return mapRow({ id: Number(result.lastInsertRowid), year: ref.year, month: ref.month, is_closed: 0, closed_at: null });
}

export function getPeriodStatus(ref: PeriodRef): Period {
  return ensurePeriod(ref);
}

/** Every year/month that has recorded activity (invoices or stock-outs) or an explicit period row, newest first. */
export function listYearsWithData(): number[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT DISTINCT year FROM (
         SELECT period_year AS year FROM invoices
         UNION SELECT CAST(strftime('%Y', movement_date) AS INTEGER) AS year FROM stock_outs
         UNION SELECT year FROM periods
       ) ORDER BY year DESC`
    )
    .all() as { year: number }[];
  const years = rows.map((r) => r.year);
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  return years.sort((a, b) => b - a);
}

export function listPeriods(): Period[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM periods ORDER BY year DESC, month DESC").all() as PeriodRow[];
  return rows.map(mapRow);
}

/**
 * Snapshots the closing balance of every product as of the end of this
 * month and marks the period closed. This is purely an auditable record —
 * live reports always recompute from stock_movements, so it can safely be
 * re-run (e.g. after a correction) without corrupting anything.
 */
export function closePeriod(ref: PeriodRef): Period {
  const db = getDb();
  const period = ensurePeriod(ref);
  const rows = getMonthlyInventoryReport(ref.year, ref.month);
  const ts = nowIso();

  db.transaction(() => {
    const upsert = db.prepare(
      `INSERT INTO period_closing_snapshots (period_id, product_id, opening_qty_milli, received_qty_milli, issued_qty_milli, closing_qty_milli)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(period_id, product_id) DO UPDATE SET
         opening_qty_milli = excluded.opening_qty_milli,
         received_qty_milli = excluded.received_qty_milli,
         issued_qty_milli = excluded.issued_qty_milli,
         closing_qty_milli = excluded.closing_qty_milli`
    );
    for (const row of rows) {
      upsert.run(period.id, row.productId, row.openingQty, row.receivedQty, row.issuedQty, row.closingQty);
    }
    db.prepare("UPDATE periods SET is_closed = 1, closed_at = ? WHERE id = ?").run(ts, period.id);
  })();

  logAudit(
    "period",
    period.id,
    "period_closed",
    `Приключен месец ${monthLabelBg(ref.month)} ${ref.year} (${rows.length} продукта)`
  );
  return getPeriodStatus(ref);
}

export function reopenPeriod(ref: PeriodRef): Period {
  const db = getDb();
  const period = ensurePeriod(ref);
  db.prepare("UPDATE periods SET is_closed = 0, closed_at = NULL WHERE id = ?").run(period.id);
  logAudit("period", period.id, "period_reopened", `Отворен отново месец ${monthLabelBg(ref.month)} ${ref.year}`);
  return getPeriodStatus(ref);
}
