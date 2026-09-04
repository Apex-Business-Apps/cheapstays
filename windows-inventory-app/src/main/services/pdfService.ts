import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";
import { getResourcesDir } from "../paths";
import { getInventoryReportForRange } from "./stockService";
import { getSettings } from "./settingsService";
import { formatMoneyBGN, formatQuantity } from "../../shared/money";
import { monthLabelBg } from "./periodService";
import type { InventoryRow } from "../../shared/types";

const COLORS = {
  text: "#1f2937",
  muted: "#6b7280",
  accent: "#0f766e",
  line: "#e5e7eb",
  headerBg: "#f0fdfa",
};

// `fontsDir` defaults to the bundled resources/fonts directory resolved via
// paths.ts (needs a running Electron app). Tests pass the repo's
// resources/fonts path directly so this module never has to touch Electron.
function registerFonts(doc: PDFKit.PDFDocument, fontsDir: string): void {
  doc.registerFont("body", path.join(fontsDir, "DejaVuSans.ttf"));
  doc.registerFont("bold", path.join(fontsDir, "DejaVuSans-Bold.ttf"));
}

function defaultFontsDir(): string {
  return path.join(getResourcesDir(), "fonts");
}

function drawHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string): void {
  const settings = getSettings();
  doc.font("bold").fontSize(18).fillColor(COLORS.text).text("СКЛАДОВ ОТЧЕТ", { align: "left" });
  doc.font("body").fontSize(10).fillColor(COLORS.muted).text(settings.companyName);
  doc.moveDown(0.6);
  doc.font("bold").fontSize(13).fillColor(COLORS.accent).text(title);
  doc.font("body").fontSize(10).fillColor(COLORS.muted).text(subtitle);
  doc.moveDown(0.3);
  doc
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, doc.y)
    .lineTo(doc.page.width - doc.page.margins.right, doc.y)
    .stroke();
  doc.moveDown(0.8);
}

interface Col {
  header: string;
  width: number;
  align?: "left" | "right" | "center";
  get: (row: InventoryRow) => string;
}

function buildColumns(): Col[] {
  return [
    { header: "Продукт", width: 150, get: (r) => r.productName },
    { header: "Мярка", width: 55, align: "center", get: (r) => (r.unit === "kg" ? "кг." : "бр.") },
    { header: "Начално", width: 75, align: "right", get: (r) => formatQuantity(r.openingQty, r.unit).split(" ")[0] },
    { header: "Получено", width: 75, align: "right", get: (r) => formatQuantity(r.receivedQty, r.unit).split(" ")[0] },
    { header: "Изход", width: 75, align: "right", get: (r) => formatQuantity(r.issuedQty, r.unit).split(" ")[0] },
    { header: "Остатък", width: 80, align: "right", get: (r) => formatQuantity(r.closingQty, r.unit).split(" ")[0] },
    { header: "Стойност", width: 90, align: "right", get: (r) => formatMoneyBGN(r.valuationCents) },
  ];
}

function drawTable(doc: PDFKit.PDFDocument, rows: InventoryRow[]): void {
  const columns = buildColumns();
  const startX = doc.page.margins.left;
  const tableWidth = columns.reduce((s, c) => s + c.width, 0);

  function drawRowBg(y: number, height: number, color: string): void {
    doc.rect(startX, y, tableWidth, height).fill(color);
    doc.fillColor(COLORS.text);
  }

  function drawHeaderRow(): void {
    const y = doc.y;
    drawRowBg(y, 22, COLORS.headerBg);
    let x = startX;
    doc.font("bold").fontSize(9).fillColor(COLORS.text);
    for (const col of columns) {
      doc.text(col.header, x + 4, y + 6, { width: col.width - 8, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y = y + 22;
  }

  function ensureSpace(rowHeight: number): void {
    if (doc.y + rowHeight > doc.page.height - doc.page.margins.bottom - 60) {
      doc.addPage();
      drawHeaderRow();
    }
  }

  drawHeaderRow();
  doc.font("body").fontSize(9);

  let totalValue = 0;
  rows.forEach((row, idx) => {
    ensureSpace(20);
    const y = doc.y;
    if (idx % 2 === 1) drawRowBg(y, 20, "#fafafa");
    let x = startX;
    doc.fillColor(COLORS.text);
    for (const col of columns) {
      doc.text(col.get(row), x + 4, y + 5, { width: col.width - 8, align: col.align ?? "left" });
      x += col.width;
    }
    doc.y = y + 20;
    totalValue += row.valuationCents;
  });

  doc
    .strokeColor(COLORS.line)
    .lineWidth(1)
    .moveTo(startX, doc.y)
    .lineTo(startX + tableWidth, doc.y)
    .stroke();
  doc.moveDown(0.5);

  doc.font("bold").fontSize(11).fillColor(COLORS.text);
  doc.text(`ОБЩО стойност на наличностите: ${formatMoneyBGN(totalValue)}`, startX, doc.y, {
    width: tableWidth,
    align: "right",
  });
}

function finalizeAndSave(doc: PDFKit.PDFDocument, filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.end();
    stream.on("finish", () => resolve(filePath));
    stream.on("error", reject);
  });
}

function newDoc(fontsDir: string): PDFKit.PDFDocument {
  const doc = new PDFDocument({ size: "A4", margin: 40, autoFirstPage: true });
  registerFonts(doc, fontsDir);
  doc.font("body");
  return doc;
}

export async function exportMonthlyReportPdf(
  year: number,
  month: number,
  filePath: string,
  fontsDir: string = defaultFontsDir()
): Promise<string> {
  const doc = newDoc(fontsDir);
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const rows = getInventoryReportForRange(start, endExclusive);
  drawHeader(doc, `Месец: ${monthLabelBg(month)} ${year}`, `Период: ${start} – ${addDaysIso(endExclusive, -1)}`);
  drawTable(doc, rows);
  return finalizeAndSave(doc, filePath);
}

export async function exportCustomPeriodReportPdf(
  from: string,
  to: string,
  filePath: string,
  fontsDir: string = defaultFontsDir()
): Promise<string> {
  const doc = newDoc(fontsDir);
  const toExclusive = addDaysIso(to, 1);
  const rows = getInventoryReportForRange(from, toExclusive);
  drawHeader(doc, "Отчет за избран период", `Период: ${from} – ${to}`);
  drawTable(doc, rows);
  return finalizeAndSave(doc, filePath);
}

export async function exportYearlyReportPdf(
  year: number,
  filePath: string,
  fontsDir: string = defaultFontsDir()
): Promise<string> {
  const doc = newDoc(fontsDir);
  const rows = getInventoryReportForRange(`${year}-01-01`, `${year + 1}-01-01`);
  drawHeader(doc, `Годишен отчет: ${year}`, `Период: ${year}-01-01 – ${year}-12-31`);
  drawTable(doc, rows);
  return finalizeAndSave(doc, filePath);
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function suggestedMonthlyFileName(year: number, month: number): string {
  return `Sklad_${String(month).padStart(2, "0")}_${year}.pdf`;
}

export function suggestedYearlyFileName(year: number): string {
  return `Sklad_Godishen_${year}.pdf`;
}

export function suggestedCustomFileName(from: string, to: string): string {
  return `Sklad_${from}_${to}.pdf`;
}
