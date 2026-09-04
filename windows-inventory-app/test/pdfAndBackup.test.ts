import fs from "node:fs";
import path from "node:path";
import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { setupTestDb, teardownTestDb, makeTempDir, FONTS_DIR } from "./testUtils";
import * as productService from "../src/main/services/productService";
import * as invoiceService from "../src/main/services/invoiceService";
import * as stockOutService from "../src/main/services/stockOutService";
import * as pdfService from "../src/main/services/pdfService";
import * as backupService from "../src/main/services/backupService";
import * as stockService from "../src/main/services/stockService";
import { getDbFilePath } from "../src/main/db/database";

beforeEach(() => setupTestDb());
afterEach(() => teardownTestDb());

function seedSampleData() {
  const p1 = productService.createProduct({ name: "Домати", unit: "kg", invoicePriceCents: 250, salePriceCents: 350 });
  const p2 = productService.createProduct({ name: "Краставици", unit: "kg", invoicePriceCents: 220, salePriceCents: 300 });
  invoiceService.createInvoice({
    invoiceNumber: "125",
    supplierId: null,
    supplierName: "Зеленчуци ЕООД",
    invoiceDate: "2026-09-05",
    items: [
      { productId: p1.id, quantity: 20, invoicePriceCents: 250, salePriceCents: 350 },
      { productId: p2.id, quantity: 15, invoicePriceCents: 220, salePriceCents: 300 },
    ],
  });
  stockOutService.createStockOut({ productId: p1.id, movementDate: "2026-09-10", quantity: 5, reason: "sale" });
  return { p1, p2 };
}

describe("12. PDF export", () => {
  it("generates a non-trivial monthly PDF report with real content", async () => {
    seedSampleData();
    const dir = makeTempDir("inv-pdf-");
    const filePath = path.join(dir, "Sklad_09_2026.pdf");
    const result = await pdfService.exportMonthlyReportPdf(2026, 9, filePath, FONTS_DIR);
    expect(result).toBe(filePath);
    expect(fs.existsSync(filePath)).toBe(true);
    const stat = fs.statSync(filePath);
    expect(stat.size).toBeGreaterThan(2000); // a real, rendered PDF, not a stub
    const header = fs.readFileSync(filePath, { encoding: "latin1", flag: "r" }).slice(0, 5);
    expect(header).toBe("%PDF-");
  });

  it("generates a custom-period PDF report", async () => {
    seedSampleData();
    const dir = makeTempDir("inv-pdf-custom-");
    const filePath = path.join(dir, "custom.pdf");
    await pdfService.exportCustomPeriodReportPdf("2026-09-01", "2026-09-15", filePath, FONTS_DIR);
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.statSync(filePath).size).toBeGreaterThan(2000);
  });

  it("generates a yearly PDF report", async () => {
    seedSampleData();
    const dir = makeTempDir("inv-pdf-year-");
    const filePath = path.join(dir, "year.pdf");
    await pdfService.exportYearlyReportPdf(2026, filePath, FONTS_DIR);
    expect(fs.existsSync(filePath)).toBe(true);
  });
});

describe("13. Backup", () => {
  it("creates a real backup file that is a valid copy of the database", () => {
    seedSampleData();
    const backupsDir = makeTempDir("inv-backups-");
    const info = backupService.createBackup("manual", backupsDir);
    expect(fs.existsSync(info.filePath)).toBe(true);
    expect(info.fileSizeBytes).toBeGreaterThan(0);

    const list = backupService.listBackups(backupsDir);
    expect(list.some((b) => b.filePath === info.filePath)).toBe(true);
  });
});

describe("14. Restore", () => {
  it("restores the database to the state captured in the backup, discarding later changes", () => {
    const { p1 } = seedSampleData();
    const backupsDir = makeTempDir("inv-restore-");
    const backup = backupService.createBackup("manual", backupsDir);

    // Make a further change that should disappear after restoring the earlier backup.
    stockOutService.createStockOut({ productId: p1.id, movementDate: "2026-09-11", quantity: 3, reason: "waste" });
    const productsBeforeRestore = productService.listProducts();
    expect(productsBeforeRestore).toHaveLength(2);

    const balanceBeforeRestore = stockService.getCurrentBalance(p1.id);
    expect(balanceBeforeRestore).toBe(12_000); // 20 - 5 - 3

    backupService.restoreFromBackup(backup.filePath, backupsDir);

    const balanceAfterRestore = stockService.getCurrentBalance(p1.id);
    expect(balanceAfterRestore).toBe(15_000); // back to 20 - 5, the extra -3 is gone

    // A pre-restore safety backup must have been taken automatically.
    const list = backupService.listBackups(backupsDir);
    expect(list.some((b) => b.kind === "pre_restore")).toBe(true);
  });

  it("keeps the live database file path stable after restore (app can keep running)", () => {
    seedSampleData();
    const backupsDir = makeTempDir("inv-restore2-");
    const before = getDbFilePath();
    const backup = backupService.createBackup("manual", backupsDir);
    backupService.restoreFromBackup(backup.filePath, backupsDir);
    expect(getDbFilePath()).toBe(before);
  });
});
