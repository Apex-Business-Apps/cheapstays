import { getDb, nowIso } from "../db/database";
import { Errors } from "../errors";
import { logAudit } from "./auditService";
import { getOrCreateSupplierByName, getSupplier } from "./supplierService";
import { getProduct } from "./productService";
import { assertReductionKeepsStockNonNegative } from "./stockService";
import { quantityToMilli, milliToQuantity, centsFromMilliAndUnitPrice, formatQuantity, formatMoneyBGN } from "../../shared/money";
import type { Invoice, InvoiceInput, InvoiceItem, Unit } from "../../shared/types";

interface InvoiceRow {
  id: number;
  invoice_number: string;
  supplier_id: number;
  invoice_date: string;
  period_year: number;
  period_month: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

interface InvoiceItemRow {
  id: number;
  invoice_id: number;
  product_id: number;
  unit: Unit;
  quantity_milli: number;
  invoice_price_cents: number;
  sale_price_cents: number;
}

function validateInput(input: InvoiceInput): void {
  if (!input.invoiceNumber || !input.invoiceNumber.trim())
    throw Errors.validation("Номерът на фактурата е задължителен.");
  if (!input.invoiceDate || !/^\d{4}-\d{2}-\d{2}$/.test(input.invoiceDate))
    throw Errors.validation("Невалидна дата на фактурата.");
  if (!input.supplierId && !input.supplierName?.trim())
    throw Errors.validation("Изберете или въведете доставчик.");
  if (!input.items || input.items.length === 0)
    throw Errors.validation("Фактурата трябва да съдържа поне един продукт.");
  for (const item of input.items) {
    if (!item.productId) throw Errors.validation("Изберете продукт за всеки ред от фактурата.");
    if (!Number.isFinite(item.quantity) || item.quantity <= 0)
      throw Errors.validation("Количеството трябва да бъде положително число.");
    if (!Number.isFinite(item.invoicePriceCents) || item.invoicePriceCents < 0)
      throw Errors.validation("Невалидна цена по фактура.");
    if (!Number.isFinite(item.salePriceCents) || item.salePriceCents < 0)
      throw Errors.validation("Невалидна изходна цена.");
  }
}

function buildInvoiceFromRow(row: InvoiceRow): Invoice {
  const db = getDb();
  const supplier = getSupplier(row.supplier_id);
  const itemRows = db
    .prepare("SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY id")
    .all(row.id) as InvoiceItemRow[];

  const items: InvoiceItem[] = itemRows.map((r) => {
    const product = getProduct(r.product_id);
    const valuePurchaseCents = centsFromMilliAndUnitPrice(r.quantity_milli, r.invoice_price_cents);
    const valueSaleCents = centsFromMilliAndUnitPrice(r.quantity_milli, r.sale_price_cents);
    return {
      id: r.id,
      invoiceId: r.invoice_id,
      productId: r.product_id,
      productName: product.name,
      unit: r.unit,
      quantityMilli: r.quantity_milli,
      invoicePriceCents: r.invoice_price_cents,
      salePriceCents: r.sale_price_cents,
      valuePurchaseCents,
      valueSaleCents,
    };
  });

  const totalQuantityByUnit: Partial<Record<Unit, number>> = {};
  let totalPurchaseCents = 0;
  let totalSaleCents = 0;
  for (const it of items) {
    totalQuantityByUnit[it.unit] = (totalQuantityByUnit[it.unit] ?? 0) + milliToQuantity(it.quantityMilli);
    totalPurchaseCents += it.valuePurchaseCents;
    totalSaleCents += it.valueSaleCents;
  }

  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    supplierId: row.supplier_id,
    supplierName: supplier.name,
    invoiceDate: row.invoice_date,
    periodYear: row.period_year,
    periodMonth: row.period_month,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
    totals: { totalQuantityByUnit, totalPurchaseCents, totalSaleCents },
  };
}

export function getInvoice(id: number): Invoice {
  const row = getDb().prepare("SELECT * FROM invoices WHERE id = ?").get(id) as InvoiceRow | undefined;
  if (!row) throw Errors.notFound("Фактурата");
  return buildInvoiceFromRow(row);
}

export function listInvoices(opts: { year?: number; month?: number; from?: string; to?: string; search?: string } = {}): Invoice[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.year) {
    clauses.push("period_year = ?");
    params.push(opts.year);
  }
  if (opts.month) {
    clauses.push("period_month = ?");
    params.push(opts.month);
  }
  if (opts.from) {
    clauses.push("invoice_date >= ?");
    params.push(opts.from);
  }
  if (opts.to) {
    clauses.push("invoice_date <= ?");
    params.push(opts.to);
  }
  if (opts.search && opts.search.trim()) {
    clauses.push(
      "(bg_lower(invoice_number) LIKE bg_lower(?) OR supplier_id IN (SELECT id FROM suppliers WHERE bg_lower(name) LIKE bg_lower(?)))"
    );
    params.push(`%${opts.search.trim()}%`, `%${opts.search.trim()}%`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rows = db
    .prepare(`SELECT * FROM invoices ${where} ORDER BY invoice_date DESC, id DESC`)
    .all(...params) as InvoiceRow[];
  return rows.map(buildInvoiceFromRow);
}

function resolveSupplierId(input: InvoiceInput): number {
  if (input.supplierId) return input.supplierId;
  return getOrCreateSupplierByName(input.supplierName!).id;
}

export function createInvoice(input: InvoiceInput): Invoice {
  validateInput(input);
  const db = getDb();
  const supplierId = resolveSupplierId(input);

  const duplicate = db
    .prepare("SELECT id FROM invoices WHERE bg_lower(invoice_number) = bg_lower(?) AND supplier_id = ?")
    .get(input.invoiceNumber.trim(), supplierId);
  if (duplicate) throw Errors.duplicateInvoiceNumber(input.invoiceNumber.trim());

  const [year, month] = input.invoiceDate.split("-").map(Number);
  const ts = nowIso();

  const insertInvoice = db.prepare(
    `INSERT INTO invoices (invoice_number, supplier_id, invoice_date, period_year, period_month, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO invoice_items (invoice_id, product_id, unit, quantity_milli, invoice_price_cents, sale_price_cents, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertMovement = db.prepare(
    `INSERT INTO stock_movements (product_id, movement_date, direction, quantity_milli, source_type, source_id, note, created_at)
     VALUES (?, ?, 'in', ?, 'invoice_item', ?, ?, ?)`
  );

  const invoiceId = db.transaction(() => {
    const result = insertInvoice.run(
      input.invoiceNumber.trim(),
      supplierId,
      input.invoiceDate,
      year,
      month,
      input.note?.trim() || null,
      ts,
      ts
    );
    const newInvoiceId = Number(result.lastInsertRowid);

    for (const item of input.items) {
      const product = getProduct(item.productId);
      const quantityMilli = quantityToMilli(item.quantity);
      const itemResult = insertItem.run(
        newInvoiceId,
        item.productId,
        product.unit,
        quantityMilli,
        item.invoicePriceCents,
        item.salePriceCents,
        ts,
        ts
      );
      insertMovement.run(
        item.productId,
        input.invoiceDate,
        quantityMilli,
        Number(itemResult.lastInsertRowid),
        `Получено по фактура № ${input.invoiceNumber.trim()}`,
        ts
      );
    }
    return newInvoiceId;
  })();

  const invoice = getInvoice(invoiceId);
  logAudit(
    "invoice",
    invoice.id,
    "created",
    `Добавена фактура № ${invoice.invoiceNumber} от „${invoice.supplierName}“ (${invoice.items.length} ${
      invoice.items.length === 1 ? "продукт" : "продукта"
    })`
  );
  return invoice;
}

/** Full replace-and-recalculate update, per spec §10 ("всички свързани изчисления трябва автоматично да се преизчислят"). */
export function updateInvoice(id: number, input: InvoiceInput): Invoice {
  validateInput(input);
  const db = getDb();
  const existing = getInvoice(id);
  const supplierId = resolveSupplierId(input);

  const duplicate = db
    .prepare("SELECT id FROM invoices WHERE bg_lower(invoice_number) = bg_lower(?) AND supplier_id = ? AND id != ?")
    .get(input.invoiceNumber.trim(), supplierId, id);
  if (duplicate) throw Errors.duplicateInvoiceNumber(input.invoiceNumber.trim());

  const [year, month] = input.invoiceDate.split("-").map(Number);
  const ts = nowIso();

  db.transaction(() => {
    // Validate that removing/reducing every previous line stays safe BEFORE
    // touching anything, so a rejected edit never leaves a half-applied state.
    for (const oldItem of existing.items) {
      const stillPresentQty = input.items
        .filter((i) => i.productId === oldItem.productId)
        .reduce((sum, i) => sum + quantityToMilli(i.quantity), 0);
      const reduction = oldItem.quantityMilli - stillPresentQty;
      if (reduction > 0) {
        const product = getProduct(oldItem.productId);
        assertReductionKeepsStockNonNegative(oldItem.productId, product.name, existing.invoiceDate, reduction, db);
      }
    }

    db.prepare("DELETE FROM stock_movements WHERE source_type = 'invoice_item' AND source_id IN (SELECT id FROM invoice_items WHERE invoice_id = ?)").run(id);
    db.prepare("DELETE FROM invoice_items WHERE invoice_id = ?").run(id);

    db.prepare(
      `UPDATE invoices SET invoice_number = ?, supplier_id = ?, invoice_date = ?, period_year = ?, period_month = ?, note = ?, updated_at = ?
       WHERE id = ?`
    ).run(input.invoiceNumber.trim(), supplierId, input.invoiceDate, year, month, input.note?.trim() || null, ts, id);

    const insertItem = db.prepare(
      `INSERT INTO invoice_items (invoice_id, product_id, unit, quantity_milli, invoice_price_cents, sale_price_cents, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (product_id, movement_date, direction, quantity_milli, source_type, source_id, note, created_at)
       VALUES (?, ?, 'in', ?, 'invoice_item', ?, ?, ?)`
    );

    for (const item of input.items) {
      const product = getProduct(item.productId);
      const quantityMilli = quantityToMilli(item.quantity);
      const itemResult = insertItem.run(id, item.productId, product.unit, quantityMilli, item.invoicePriceCents, item.salePriceCents, ts, ts);
      insertMovement.run(
        item.productId,
        input.invoiceDate,
        quantityMilli,
        Number(itemResult.lastInsertRowid),
        `Получено по фактура № ${input.invoiceNumber.trim()}`,
        ts
      );
    }
  })();

  const updated = getInvoice(id);
  logAudit(
    "invoice",
    id,
    "updated",
    `Редактирана фактура № ${updated.invoiceNumber} (било № ${existing.invoiceNumber}, ${existing.items.length} → ${updated.items.length} реда)`
  );
  return updated;
}

export function deleteInvoice(id: number): void {
  const db = getDb();
  const invoice = getInvoice(id);

  db.transaction(() => {
    for (const item of invoice.items) {
      const product = getProduct(item.productId);
      assertReductionKeepsStockNonNegative(item.productId, product.name, invoice.invoiceDate, item.quantityMilli, db);
    }
    db.prepare(
      "DELETE FROM stock_movements WHERE source_type = 'invoice_item' AND source_id IN (SELECT id FROM invoice_items WHERE invoice_id = ?)"
    ).run(id);
    db.prepare("DELETE FROM invoices WHERE id = ?").run(id);
  })();

  logAudit(
    "invoice",
    id,
    "deleted",
    `Изтрита фактура № ${invoice.invoiceNumber} от „${invoice.supplierName}“ (${formatMoneyBGN(invoice.totals.totalPurchaseCents)})`
  );
}
