import { getDb, nowIso } from "../db/database";
import { Errors } from "../errors";
import { logAudit } from "./auditService";
import { getProduct } from "./productService";
import { assertSufficientStock } from "./stockService";
import { quantityToMilli, formatQuantity } from "../../shared/money";
import type { StockOut, StockOutInput, StockOutReason, Unit } from "../../shared/types";

interface StockOutRow {
  id: number;
  product_id: number;
  movement_date: string;
  quantity_milli: number;
  reason: StockOutReason;
  note: string | null;
  created_at: string;
  updated_at: string;
}

const REASON_LABELS_BG: Record<StockOutReason, string> = {
  sale: "Продажба",
  waste: "Брак",
  return: "Връщане на доставчик",
  other: "Друго",
};

function mapRow(r: StockOutRow, productName: string, unit: Unit): StockOut {
  return {
    id: r.id,
    productId: r.product_id,
    productName,
    unit,
    movementDate: r.movement_date,
    quantityMilli: r.quantity_milli,
    reason: r.reason,
    note: r.note,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function validate(input: StockOutInput): void {
  if (!input.productId) throw Errors.validation("Изберете продукт.");
  if (!input.movementDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.movementDate))
    throw Errors.validation("Невалидна дата.");
  if (!Number.isFinite(input.quantity) || input.quantity <= 0)
    throw Errors.validation("Количеството трябва да бъде положително число.");
  const validReasons: StockOutReason[] = ["sale", "waste", "return", "other"];
  if (!validReasons.includes(input.reason)) throw Errors.validation("Невалидна причина за изписване.");
}

export function getStockOut(id: number): StockOut {
  const db = getDb();
  const row = db.prepare("SELECT * FROM stock_outs WHERE id = ?").get(id) as StockOutRow | undefined;
  if (!row) throw Errors.notFound("Записът за изписване");
  const product = getProduct(row.product_id);
  return mapRow(row, product.name, product.unit);
}

export function listStockOuts(opts: { year?: number; month?: number; from?: string; to?: string; productId?: number; search?: string } = {}): StockOut[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.year) {
    clauses.push("strftime('%Y', movement_date) = ?");
    params.push(String(opts.year));
  }
  if (opts.month) {
    clauses.push("strftime('%m', movement_date) = ?");
    params.push(String(opts.month).padStart(2, "0"));
  }
  if (opts.from) {
    clauses.push("movement_date >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push("movement_date <= ?");
    params.push(opts.to);
  }
  if (opts.productId) {
    clauses.push("product_id = ?");
    params.push(opts.productId);
  }
  if (opts.search && opts.search.trim()) {
    clauses.push(
      "product_id IN (SELECT id FROM products WHERE bg_lower(name) LIKE bg_lower(?))"
    );
    params.push(`%${opts.search.trim()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM stock_outs ${where} ORDER BY movement_date DESC, id DESC`)
    .all(...params) as StockOutRow[];
  return rows.map((r) => {
    const product = getProduct(r.product_id);
    return mapRow(r, product.name, product.unit);
  });
}

export function createStockOut(input: StockOutInput): StockOut {
  validate(input);
  const db = getDb();
  const product = getProduct(input.productId);
  const quantityMilli = quantityToMilli(input.quantity);
  const ts = nowIso();

  const id = db.transaction(() => {
    assertSufficientStock(input.productId, product.name, input.movementDate, quantityMilli, null, db);
    const result = db
      .prepare(
        `INSERT INTO stock_outs (product_id, movement_date, quantity_milli, reason, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(input.productId, input.movementDate, quantityMilli, input.reason, input.note?.trim() || null, ts, ts);
    const stockOutId = Number(result.lastInsertRowid);
    db.prepare(
      `INSERT INTO stock_movements (product_id, movement_date, direction, quantity_milli, source_type, source_id, note, created_at)
       VALUES (?, ?, 'out', ?, 'stock_out', ?, ?, ?)`
    ).run(input.productId, input.movementDate, quantityMilli, stockOutId, REASON_LABELS_BG[input.reason], ts);
    return stockOutId;
  })();

  const stockOut = getStockOut(id);
  logAudit(
    "stock_out",
    id,
    "created",
    `Изписани ${formatQuantity(quantityMilli, product.unit)} „${product.name}“ (${REASON_LABELS_BG[input.reason]})`
  );
  return stockOut;
}

export function updateStockOut(id: number, input: StockOutInput): StockOut {
  validate(input);
  const db = getDb();
  const existing = getStockOut(id);
  const product = getProduct(input.productId);
  const quantityMilli = quantityToMilli(input.quantity);
  const ts = nowIso();

  db.transaction(() => {
    // Exclude this row's own ledger entry, then re-check sufficiency for the new figures.
    db.prepare("DELETE FROM stock_movements WHERE source_type = 'stock_out' AND source_id = ?").run(id);
    assertSufficientStock(input.productId, product.name, input.movementDate, quantityMilli, null, db);

    db.prepare(
      `UPDATE stock_outs SET product_id = ?, movement_date = ?, quantity_milli = ?, reason = ?, note = ?, updated_at = ?
       WHERE id = ?`
    ).run(input.productId, input.movementDate, quantityMilli, input.reason, input.note?.trim() || null, ts, id);

    db.prepare(
      `INSERT INTO stock_movements (product_id, movement_date, direction, quantity_milli, source_type, source_id, note, created_at)
       VALUES (?, ?, 'out', ?, 'stock_out', ?, ?, ?)`
    ).run(input.productId, input.movementDate, quantityMilli, id, REASON_LABELS_BG[input.reason], ts);
  })();

  const updated = getStockOut(id);
  logAudit(
    "stock_out",
    id,
    "updated",
    `Редактирано изписване на „${product.name}“ (${formatQuantity(existing.quantityMilli, existing.unit)} → ${formatQuantity(
      quantityMilli,
      product.unit
    )})`
  );
  return updated;
}

export function deleteStockOut(id: number): void {
  const db = getDb();
  const existing = getStockOut(id);
  db.transaction(() => {
    db.prepare("DELETE FROM stock_movements WHERE source_type = 'stock_out' AND source_id = ?").run(id);
    db.prepare("DELETE FROM stock_outs WHERE id = ?").run(id);
  })();
  logAudit(
    "stock_out",
    id,
    "deleted",
    `Изтрито изписване на ${formatQuantity(existing.quantityMilli, existing.unit)} „${existing.productName}“`
  );
}

export const reasonLabelsBg = REASON_LABELS_BG;
