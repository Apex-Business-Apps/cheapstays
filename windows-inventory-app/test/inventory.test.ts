import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { setupTestDb, teardownTestDb } from "./testUtils";
import * as productService from "../src/main/services/productService";
import * as invoiceService from "../src/main/services/invoiceService";
import * as stockOutService from "../src/main/services/stockOutService";
import * as stockService from "../src/main/services/stockService";
import * as periodService from "../src/main/services/periodService";

beforeEach(() => setupTestDb());
afterEach(() => teardownTestDb());

function makeProduct(name = "Домати", overrides: Partial<Parameters<typeof productService.createProduct>[0]> = {}) {
  return productService.createProduct({
    name,
    unit: "kg",
    invoicePriceCents: 250,
    salePriceCents: 350,
    ...overrides,
  });
}

describe("1. Добавяне на продукт", () => {
  it("creates a product and rejects duplicates", () => {
    const p = makeProduct();
    expect(p.id).toBeGreaterThan(0);
    expect(p.name).toBe("Домати");
    expect(() => makeProduct("домати")).toThrow(/Вече съществува/);
  });

  it("rejects invalid input", () => {
    expect(() => makeProduct("")).toThrow();
    expect(() => makeProduct("Краставици", { invoicePriceCents: -10 })).toThrow();
  });
});

describe("2 & 3. Фактура с няколко продукта", () => {
  it("creates an invoice with multiple line items and computes totals", () => {
    const tomatoes = makeProduct("Домати");
    const cucumbers = makeProduct("Краставици", { invoicePriceCents: 220, salePriceCents: 300 });

    const invoice = invoiceService.createInvoice({
      invoiceNumber: "00125",
      supplierId: null,
      supplierName: "Зеленчуци ЕООД",
      invoiceDate: "2026-09-01",
      items: [
        { productId: tomatoes.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 },
        { productId: cucumbers.id, quantity: 15, invoicePriceCents: 220, salePriceCents: 300 },
      ],
    });

    expect(invoice.items).toHaveLength(2);
    expect(invoice.totals.totalPurchaseCents).toBe(20 * 250 + 15 * 220);
    expect(invoice.totals.totalSaleCents).toBe(20 * 350 + 15 * 300);
    expect(invoice.totals.totalQuantityByUnit.kg).toBeCloseTo(35);
  });

  it("rejects a duplicate invoice number from the same supplier", () => {
    const p = makeProduct();
    const input = {
      invoiceNumber: "A-1",
      supplierId: null,
      supplierName: "Доставчик 1",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 5, invoicePriceCents: 250, salePriceCents: 350 }],
    };
    invoiceService.createInvoice(input);
    expect(() => invoiceService.createInvoice(input)).toThrow(/Вече има фактура/);
  });
});

describe("4. Получаване на стоки увеличава наличността", () => {
  it("receiving via invoice increases stock balance", () => {
    const p = makeProduct();
    expect(stockService.getCurrentBalance(p.id)).toBe(0);
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-05",
      items: [{ productId: p.id, quantity: 100, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    expect(stockService.getCurrentBalance(p.id)).toBe(100_000); // 100 kg in milli-units
  });
});

describe("5 & 6. Изписване на стоки и изчисляване на остатък", () => {
  it("reduces stock and computes the remaining balance correctly", () => {
    const p = makeProduct();
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    stockOutService.createStockOut({
      productId: p.id,
      movementDate: "2026-09-02",
      quantity: 5,
      reason: "sale",
    });
    expect(stockService.getCurrentBalance(p.id)).toBe(15_000);

    const report = stockService.getMonthlyInventoryReport(2026, 9);
    const row = report.find((r) => r.productId === p.id)!;
    expect(row.openingQty).toBe(0);
    expect(row.receivedQty).toBe(20_000);
    expect(row.issuedQty).toBe(5_000);
    expect(row.closingQty).toBe(15_000);
  });
});

describe("7. Прехвърляне на остатък към следващия месец", () => {
  it("closing balance of September becomes opening balance of October automatically", () => {
    const p = makeProduct();
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-05",
      items: [{ productId: p.id, quantity: 100, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    stockOutService.createStockOut({ productId: p.id, movementDate: "2026-09-20", quantity: 30, reason: "sale" });

    const sept = stockService.getMonthlyInventoryReport(2026, 9).find((r) => r.productId === p.id)!;
    expect(sept.closingQty).toBe(70_000);

    periodService.closePeriod({ year: 2026, month: 9 });

    // October's opening balance is derived automatically from the ledger — no manual entry required.
    const oct = stockService.getMonthlyInventoryReport(2026, 10).find((r) => r.productId === p.id)!;
    expect(oct.openingQty).toBe(70_000);
    expect(oct.receivedQty).toBe(0);
    expect(oct.closingQty).toBe(70_000);
  });
});

describe("8. Редакция на количество", () => {
  it("editing an invoice line recalculates stock and totals", () => {
    const p = makeProduct();
    const invoice = invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 50, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    expect(stockService.getCurrentBalance(p.id)).toBe(50_000);

    const updated = invoiceService.updateInvoice(invoice.id, {
      invoiceNumber: invoice.invoiceNumber,
      supplierId: invoice.supplierId,
      invoiceDate: invoice.invoiceDate,
      items: [{ productId: p.id, quantity: 45, invoicePriceCents: 250, salePriceCents: 350 }],
    });

    expect(updated.items[0].quantityMilli).toBe(45_000);
    expect(stockService.getCurrentBalance(p.id)).toBe(45_000);
  });

  it("editing a stock-out quantity recalculates the balance", () => {
    const p = makeProduct();
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    const out = stockOutService.createStockOut({ productId: p.id, movementDate: "2026-09-02", quantity: 5, reason: "sale" });
    stockOutService.updateStockOut(out.id, { productId: p.id, movementDate: "2026-09-02", quantity: 8, reason: "waste" });
    expect(stockService.getCurrentBalance(p.id)).toBe(12_000);
  });
});

describe("9. Изтриване", () => {
  it("deleting a stock-out restores the stock", () => {
    const p = makeProduct();
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    const out = stockOutService.createStockOut({ productId: p.id, movementDate: "2026-09-02", quantity: 5, reason: "sale" });
    expect(stockService.getCurrentBalance(p.id)).toBe(15_000);
    stockOutService.deleteStockOut(out.id);
    expect(stockService.getCurrentBalance(p.id)).toBe(20_000);
  });

  it("deleting an invoice removes its stock contribution", () => {
    const p = makeProduct();
    const invoice = invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    invoiceService.deleteInvoice(invoice.id);
    expect(stockService.getCurrentBalance(p.id)).toBe(0);
    expect(() => invoiceService.getInvoice(invoice.id)).toThrow();
  });

  it("prevents deleting an invoice when it would drive later stock negative", () => {
    const p = makeProduct();
    const invoice = invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    stockOutService.createStockOut({ productId: p.id, movementDate: "2026-09-05", quantity: 15, reason: "sale" });
    expect(() => invoiceService.deleteInvoice(invoice.id)).toThrow(/отрицателна наличност/);
  });
});

describe("10. Недостатъчна наличност", () => {
  it("rejects a stock-out larger than the available balance", () => {
    const p = makeProduct();
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 5, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    expect(() => stockOutService.createStockOut({ productId: p.id, movementDate: "2026-09-02", quantity: 10, reason: "sale" })).toThrow(
      /Недостатъчна наличност/
    );
    // Stock must remain untouched after the rejected attempt.
    expect(stockService.getCurrentBalance(p.id)).toBe(5_000);
  });
});

describe("11. Custom период справка", () => {
  it("reports only movements within the requested date range", () => {
    const p = makeProduct();
    invoiceService.createInvoice({
      invoiceNumber: "1",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-01",
      items: [{ productId: p.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 }],
    });
    invoiceService.createInvoice({
      invoiceNumber: "2",
      supplierId: null,
      supplierName: "Доставчик",
      invoiceDate: "2026-09-20",
      items: [{ productId: p.id, quantity: 10, invoicePriceCents: 250, salePriceCents: 350 }],
    });

    const rangeRows = stockService.getInventoryReportForRange("2026-09-01", "2026-09-16");
    const row = rangeRows.find((r) => r.productId === p.id)!;
    expect(row.receivedQty).toBe(20_000); // only the first invoice falls inside 1–15 Sep
    expect(row.closingQty).toBe(20_000);
  });
});
