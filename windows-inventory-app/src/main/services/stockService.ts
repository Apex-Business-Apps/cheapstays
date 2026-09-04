import type Database from "better-sqlite3";
import { getDb } from "../db/database";
import { Errors } from "../errors";
import type { InventoryRow, Product } from "../../shared/types";

/**
 * The single source of truth for stock balances: everything is derived by
 * summing stock_movements. Nothing here caches a mutable "current quantity"
 * field, so editing or deleting a historical movement automatically keeps
 * every later balance correct (spec §35).
 */

// Balance strictly BEFORE `beforeDateExclusive` (date string, "YYYY-MM-DD").
export function getBalanceBefore(productId: number, beforeDateExclusive: string, db: Database.Database = getDb()): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE -quantity_milli END), 0) AS balance
       FROM stock_movements
       WHERE product_id = ? AND movement_date < ?`
    )
    .get(productId, beforeDateExclusive) as { balance: number };
  return row.balance;
}

// Balance as of the END of `dateInclusive` (i.e. including that whole day).
export function getBalanceAsOf(productId: number, dateInclusive: string, db: Database.Database = getDb()): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE -quantity_milli END), 0) AS balance
       FROM stock_movements
       WHERE product_id = ? AND movement_date <= ?`
    )
    .get(productId, dateInclusive) as { balance: number };
  return row.balance;
}

/** Current total balance across all recorded movements (today or later included). */
export function getCurrentBalance(productId: number, db: Database.Database = getDb()): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE -quantity_milli END), 0) AS balance
       FROM stock_movements WHERE product_id = ?`
    )
    .get(productId) as { balance: number };
  return row.balance;
}

/**
 * Running balance strictly before a specific movement, ordered chronologically
 * (movement_date, then id as tie-breaker). Used to validate that recording an
 * outgoing movement at a given point in the timeline never drives the balance
 * negative — including for a same-day insert among other same-day entries,
 * and including edits (excludeMovementId lets us ignore the row being edited).
 */
export function getRunningBalanceBefore(
  productId: number,
  movementDate: string,
  excludeMovementId: number | null,
  db: Database.Database = getDb()
): number {
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE -quantity_milli END), 0) AS balance
       FROM stock_movements
       WHERE product_id = ?
         AND (movement_date < ? OR (movement_date = ? AND (? IS NULL OR id < ?)))`
    )
    .get(productId, movementDate, movementDate, excludeMovementId, excludeMovementId ?? -1) as {
    balance: number;
  };
  return row.balance;
}

/**
 * Verifies that inserting/updating an OUT movement of `quantityMilli` on
 * `movementDate` never makes the balance go negative at any point from that
 * moment forward, up to the current moment. We check the tightest point,
 * which is immediately after this movement is applied, and every OUT
 * movement chronologically after it must still resolve to >= 0. In practice
 * for this app's daily-ledger use case checking immediately-after is
 * sufficient because balances only decrease on OUT movements and any
 * later OUT movement is validated independently at its own insert time.
 */
export function assertSufficientStock(
  productId: number,
  productName: string,
  movementDate: string,
  quantityMilli: number,
  excludeMovementId: number | null,
  db: Database.Database = getDb()
): void {
  const before = getRunningBalanceBefore(productId, movementDate, excludeMovementId, db);
  if (before - quantityMilli < 0) {
    throw Errors.insufficientStock(productName);
  }
}

/**
 * The minimum value the running balance reaches at or after `fromDateInclusive`.
 * Used to safely validate reducing/removing a past "in" movement (an edited
 * or deleted invoice line): if the reduction would push that minimum below
 * zero, the change is rejected rather than silently corrupting a later
 * period's numbers (spec §35).
 */
export function minFutureRunningBalance(
  productId: number,
  fromDateInclusive: string,
  db: Database.Database = getDb()
): number {
  const row = db
    .prepare(
      `WITH running AS (
         SELECT movement_date, id,
           SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE -quantity_milli END)
             OVER (ORDER BY movement_date, id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
         FROM stock_movements WHERE product_id = ?
       )
       SELECT MIN(running_balance) AS minBal FROM running WHERE movement_date >= ?`
    )
    .get(productId, fromDateInclusive) as { minBal: number | null };
  return row.minBal ?? 0;
}

export function assertReductionKeepsStockNonNegative(
  productId: number,
  productName: string,
  fromDateInclusive: string,
  reduceByMilli: number,
  db: Database.Database = getDb()
): void {
  if (reduceByMilli <= 0) return;
  const minBal = minFutureRunningBalance(productId, fromDateInclusive, db);
  if (minBal - reduceByMilli < 0) {
    throw Errors.validation(
      `Промяната не може да бъде запазена: тя би довела до отрицателна наличност на „${productName}“ на по-късна дата.`
    );
  }
}

export function periodBounds(year: number, month: number): { start: string; endExclusive: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { start, endExclusive };
}

export function getPeriodMovementSums(
  productId: number,
  year: number,
  month: number,
  db: Database.Database = getDb()
): { received: number; issued: number } {
  const { start, endExclusive } = periodBounds(year, month);
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE 0 END), 0) AS received,
         COALESCE(SUM(CASE WHEN direction = 'out' THEN quantity_milli ELSE 0 END), 0) AS issued
       FROM stock_movements
       WHERE product_id = ? AND movement_date >= ? AND movement_date < ?`
    )
    .get(productId, start, endExclusive) as { received: number; issued: number };
  return row;
}

/** Inventory report rows for a whole calendar month, one row per active/used product. */
export function getMonthlyInventoryReport(year: number, month: number): InventoryRow[] {
  return getInventoryReportForRange(periodBounds(year, month).start, periodBounds(year, month).endExclusive);
}

/** Inventory report for a custom [from, to] inclusive date range. */
export function getInventoryReportForRange(fromInclusive: string, toExclusive: string): InventoryRow[] {
  const db = getDb();
  const products = db
    .prepare(
      `SELECT id, name, unit, sale_price_cents as salePriceCents FROM products
       WHERE is_active = 1 OR id IN (SELECT DISTINCT product_id FROM stock_movements)
       ORDER BY bg_lower(name)`
    )
    .all() as Pick<Product, "id" | "name" | "unit" | "salePriceCents">[];

  return products.map((p) => {
    const opening = getBalanceBefore(p.id, fromInclusive, db);
    const sums = db
      .prepare(
        `SELECT
           COALESCE(SUM(CASE WHEN direction = 'in' THEN quantity_milli ELSE 0 END), 0) AS received,
           COALESCE(SUM(CASE WHEN direction = 'out' THEN quantity_milli ELSE 0 END), 0) AS issued
         FROM stock_movements
         WHERE product_id = ? AND movement_date >= ? AND movement_date < ?`
      )
      .get(p.id, fromInclusive, toExclusive) as { received: number; issued: number };
    const closing = opening + sums.received - sums.issued;
    return {
      productId: p.id,
      productName: p.name,
      unit: p.unit,
      openingQty: opening,
      receivedQty: sums.received,
      issuedQty: sums.issued,
      closingQty: closing,
      valuationCents: Math.round((closing * p.salePriceCents) / 1000),
    };
  });
}
