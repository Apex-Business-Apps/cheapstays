import { getDb, nowIso } from "../db/database";
import { Errors } from "../errors";
import { logAudit } from "./auditService";
import { getCurrentBalance } from "./stockService";
import type { Product, ProductInput, Unit } from "../../shared/types";

interface ProductRow {
  id: number;
  name: string;
  unit: Unit;
  invoice_price_cents: number;
  sale_price_cents: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapRow(r: ProductRow): Product {
  return {
    id: r.id,
    name: r.name,
    unit: r.unit,
    invoicePriceCents: r.invoice_price_cents,
    salePriceCents: r.sale_price_cents,
    isActive: r.is_active === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function validate(input: ProductInput): void {
  if (!input.name || !input.name.trim()) throw Errors.validation("Името на продукта е задължително.");
  if (input.unit !== "kg" && input.unit !== "pcs") throw Errors.validation("Невалидна мерна единица.");
  if (!Number.isFinite(input.invoicePriceCents) || input.invoicePriceCents < 0)
    throw Errors.validation("Невалидна цена по фактура.");
  if (!Number.isFinite(input.salePriceCents) || input.salePriceCents < 0)
    throw Errors.validation("Невалидна изходна цена.");
}

export function listProducts(opts: { includeInactive?: boolean; search?: string } = {}): Product[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (!opts.includeInactive) clauses.push("is_active = 1");
  if (opts.search && opts.search.trim()) {
    clauses.push("bg_lower(name) LIKE bg_lower(?)");
    params.push(`%${opts.search.trim()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM products ${where} ORDER BY bg_lower(name)`)
    .all(...params) as ProductRow[];
  return rows.map(mapRow);
}

export function getProduct(id: number): Product {
  const row = getDb().prepare("SELECT * FROM products WHERE id = ?").get(id) as ProductRow | undefined;
  if (!row) throw Errors.notFound("Продуктът");
  return mapRow(row);
}

export function createProduct(input: ProductInput): Product {
  validate(input);
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM products WHERE bg_lower(name) = bg_lower(?)")
    .get(input.name.trim());
  if (existing) throw Errors.duplicateProductName(input.name.trim());

  const ts = nowIso();
  const result = db
    .prepare(
      `INSERT INTO products (name, unit, invoice_price_cents, sale_price_cents, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, ?, ?)`
    )
    .run(input.name.trim(), input.unit, input.invoicePriceCents, input.salePriceCents, ts, ts);

  const product = getProduct(Number(result.lastInsertRowid));
  logAudit("product", product.id, "created", `Добавен продукт „${product.name}“`);
  return product;
}

export function updateProduct(id: number, input: ProductInput): Product {
  validate(input);
  const db = getDb();
  const before = getProduct(id);

  const duplicate = db
    .prepare("SELECT id FROM products WHERE bg_lower(name) = bg_lower(?) AND id != ?")
    .get(input.name.trim(), id);
  if (duplicate) throw Errors.duplicateProductName(input.name.trim());

  db.prepare(
    `UPDATE products SET name = ?, unit = ?, invoice_price_cents = ?, sale_price_cents = ?, is_active = ?, updated_at = ?
     WHERE id = ?`
  ).run(
    input.name.trim(),
    input.unit,
    input.invoicePriceCents,
    input.salePriceCents,
    input.isActive === false ? 0 : 1,
    nowIso(),
    id
  );

  const after = getProduct(id);
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`име от „${before.name}“ на „${after.name}“`);
  if (before.invoicePriceCents !== after.invoicePriceCents)
    changes.push(`цена по фактура от ${(before.invoicePriceCents / 100).toFixed(2)} на ${(after.invoicePriceCents / 100).toFixed(2)} лв.`);
  if (before.salePriceCents !== after.salePriceCents)
    changes.push(`изходна цена от ${(before.salePriceCents / 100).toFixed(2)} на ${(after.salePriceCents / 100).toFixed(2)} лв.`);
  logAudit(
    "product",
    id,
    "updated",
    changes.length ? `Редактиран продукт „${after.name}“ (${changes.join(", ")})` : `Редактиран продукт „${after.name}“`
  );
  return after;
}

export function setProductActive(id: number, isActive: boolean): Product {
  const db = getDb();
  const product = getProduct(id);
  db.prepare("UPDATE products SET is_active = ?, updated_at = ? WHERE id = ?").run(
    isActive ? 1 : 0,
    nowIso(),
    id
  );
  logAudit(
    "product",
    id,
    isActive ? "activated" : "deactivated",
    `Продукт „${product.name}“ ${isActive ? "активиран" : "деактивиран"}`
  );
  return getProduct(id);
}

export function deleteProduct(id: number): void {
  const db = getDb();
  const product = getProduct(id);
  const hasMovements = db
    .prepare("SELECT 1 FROM stock_movements WHERE product_id = ? LIMIT 1")
    .get(id);
  if (hasMovements) {
    throw Errors.validation(
      `Продукт „${product.name}“ има история на движения и не може да бъде изтрит. Деактивирайте го вместо това.`
    );
  }
  db.prepare("DELETE FROM products WHERE id = ?").run(id);
  logAudit("product", id, "deleted", `Изтрит продукт „${product.name}“`);
}

export function getProductCurrentStock(id: number): number {
  return getCurrentBalance(id);
}
