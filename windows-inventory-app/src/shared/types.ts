// Shared types between the Electron main process and the renderer.
// Money is always represented in "stotinki" (integer cents of BGN) to avoid
// floating point rounding errors. Quantities are represented in "milli-units"
// (integer, quantity * 1000) so that both кг. (fractional) and бр. (whole)
// products can be stored precisely without floats.

export type Unit = "kg" | "pcs";

export interface Product {
  id: number;
  name: string;
  unit: Unit;
  invoicePriceCents: number;
  salePriceCents: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  name: string;
  unit: Unit;
  invoicePriceCents: number;
  salePriceCents: number;
  isActive?: boolean;
}

export interface Supplier {
  id: number;
  name: string;
  createdAt: string;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  supplierId: number;
  supplierName: string;
  invoiceDate: string; // YYYY-MM-DD
  periodYear: number;
  periodMonth: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  items: InvoiceItem[];
  totals: {
    totalQuantityByUnit: Partial<Record<Unit, number>>; // in real units (not milli)
    totalPurchaseCents: number;
    totalSaleCents: number;
  };
}

export interface InvoiceItem {
  id: number;
  invoiceId: number;
  productId: number;
  productName: string;
  unit: Unit;
  quantityMilli: number;
  invoicePriceCents: number;
  salePriceCents: number;
  valuePurchaseCents: number;
  valueSaleCents: number;
}

export interface InvoiceItemInput {
  productId: number;
  quantity: number; // real units, e.g. 20.5
  invoicePriceCents: number;
  salePriceCents: number;
}

export interface InvoiceInput {
  invoiceNumber: string;
  supplierId: number | null;
  supplierName?: string; // if supplierId is null, create supplier by name
  invoiceDate: string;
  note?: string;
  items: InvoiceItemInput[];
}

export type StockOutReason = "sale" | "waste" | "return" | "other";

export interface StockOut {
  id: number;
  productId: number;
  productName: string;
  unit: Unit;
  movementDate: string;
  quantityMilli: number;
  reason: StockOutReason;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StockOutInput {
  productId: number;
  movementDate: string;
  quantity: number;
  reason: StockOutReason;
  note?: string;
}

export interface StockMovement {
  id: number;
  productId: number;
  movementDate: string;
  direction: "in" | "out";
  quantityMilli: number;
  sourceType: "invoice_item" | "stock_out" | "adjustment";
  sourceId: number | null;
  note: string | null;
  createdAt: string;
}

export interface InventoryRow {
  productId: number;
  productName: string;
  unit: Unit;
  openingQty: number;
  receivedQty: number;
  issuedQty: number;
  closingQty: number;
  valuationCents: number; // closingQty * salePriceCents
}

export interface PeriodRef {
  year: number;
  month: number; // 1-12
}

export interface Period extends PeriodRef {
  id: number;
  isClosed: boolean;
  closedAt: string | null;
}

export interface DashboardStats {
  totalProducts: number;
  totalStockQtyByUnit: Partial<Record<Unit, number>>;
  receivedValueThisMonthCents: number;
  issuedQtyThisMonthByUnit: Partial<Record<Unit, number>>;
  stockValuationCents: number;
  recentActivity: ActivityEntry[];
}

export interface ActivityEntry {
  id: number;
  type: "receiving" | "stock_out" | "edit" | "delete" | "period_closed" | "backup" | "restore" | "product";
  description: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  entityType: string;
  entityId: number | null;
  action: string;
  description: string;
  createdAt: string;
}

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface BackupInfo {
  fileName: string;
  filePath: string;
  fileSizeBytes: number;
  createdAt: string;
  kind: "manual" | "scheduled" | "pre_restore";
}

export interface Settings {
  autoBackupEnabled: boolean;
  autoBackupIntervalDays: number;
  lastAutoBackupAt: string | null;
  companyName: string;
}

export interface ApiError {
  code: string;
  message: string; // Bulgarian, user-facing
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}
