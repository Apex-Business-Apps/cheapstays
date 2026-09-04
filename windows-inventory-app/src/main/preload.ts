// NOTE: `webPreferences.sandbox: true` (index.ts) runs this preload script
// through Electron's sandboxed loader, whose `require()` only resolves
// 'electron' and Node built-ins — a plain relative `require("../shared/...")`
// fails there even though it works fine under a normal Node `require`. This
// file is therefore bundled by esbuild (see the `build:preload` npm script)
// into a single dependency-free dist/main/preload.js before packaging; only
// write plain TypeScript here and let the bundler resolve the local imports.
import { contextBridge, ipcRenderer } from "electron";
import { IpcChannels } from "../shared/ipcChannels";
import type {
  ApiResult,
  BackupInfo,
  DashboardStats,
  Invoice,
  InvoiceInput,
  InventoryRow,
  AuditLogEntry,
  Period,
  PeriodRef,
  Product,
  ProductInput,
  Settings,
  StockOut,
  StockOutInput,
  Supplier,
} from "../shared/types";

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as ApiResult<T>;
  if (!result.ok) {
    const err = new Error(result.error?.message ?? "Възникна грешка.") as Error & { code?: string };
    err.code = result.error?.code;
    throw err;
  }
  return result.data as T;
}

const api = {
  products: {
    list: (opts?: { includeInactive?: boolean; search?: string }) =>
      invoke<Product[]>(IpcChannels.products.list, opts ?? {}),
    get: (id: number) => invoke<Product>(IpcChannels.products.get, id),
    create: (input: ProductInput) => invoke<Product>(IpcChannels.products.create, input),
    update: (id: number, input: ProductInput) => invoke<Product>(IpcChannels.products.update, id, input),
    setActive: (id: number, isActive: boolean) => invoke<Product>(IpcChannels.products.setActive, id, isActive),
    delete: (id: number) => invoke<void>(IpcChannels.products.delete, id),
    currentStock: (id: number) => invoke<number>(IpcChannels.products.currentStock, id),
  },
  suppliers: {
    list: (search?: string) => invoke<Supplier[]>(IpcChannels.suppliers.list, search),
  },
  invoices: {
    list: (opts?: { year?: number; month?: number; from?: string; to?: string; search?: string }) =>
      invoke<Invoice[]>(IpcChannels.invoices.list, opts ?? {}),
    get: (id: number) => invoke<Invoice>(IpcChannels.invoices.get, id),
    create: (input: InvoiceInput) => invoke<Invoice>(IpcChannels.invoices.create, input),
    update: (id: number, input: InvoiceInput) => invoke<Invoice>(IpcChannels.invoices.update, id, input),
    delete: (id: number) => invoke<void>(IpcChannels.invoices.delete, id),
  },
  stockOuts: {
    list: (opts?: { year?: number; month?: number; from?: string; to?: string; productId?: number; search?: string }) =>
      invoke<StockOut[]>(IpcChannels.stockOuts.list, opts ?? {}),
    get: (id: number) => invoke<StockOut>(IpcChannels.stockOuts.get, id),
    create: (input: StockOutInput) => invoke<StockOut>(IpcChannels.stockOuts.create, input),
    update: (id: number, input: StockOutInput) => invoke<StockOut>(IpcChannels.stockOuts.update, id, input),
    delete: (id: number) => invoke<void>(IpcChannels.stockOuts.delete, id),
  },
  inventory: {
    monthlyReport: (year: number, month: number) =>
      invoke<InventoryRow[]>(IpcChannels.inventory.monthlyReport, year, month),
    rangeReport: (from: string, to: string) => invoke<InventoryRow[]>(IpcChannels.inventory.rangeReport, from, to),
  },
  periods: {
    listYears: () => invoke<number[]>(IpcChannels.periods.listYears),
    list: () => invoke<Period[]>(IpcChannels.periods.list),
    status: (ref: PeriodRef) => invoke<Period>(IpcChannels.periods.status, ref),
    close: (ref: PeriodRef) => invoke<Period>(IpcChannels.periods.close, ref),
    reopen: (ref: PeriodRef) => invoke<Period>(IpcChannels.periods.reopen, ref),
  },
  dashboard: {
    stats: () => invoke<DashboardStats>(IpcChannels.dashboard.stats),
  },
  audit: {
    list: (limit?: number) => invoke<AuditLogEntry[]>(IpcChannels.audit.list, limit),
    search: (query: string, limit?: number) => invoke<AuditLogEntry[]>(IpcChannels.audit.search, query, limit),
  },
  pdf: {
    exportMonthly: (year: number, month: number) =>
      invoke<string | null>(IpcChannels.pdf.exportMonthly, year, month),
    exportYearly: (year: number) => invoke<string | null>(IpcChannels.pdf.exportYearly, year),
    exportCustom: (from: string, to: string) => invoke<string | null>(IpcChannels.pdf.exportCustom, from, to),
  },
  backup: {
    list: () => invoke<BackupInfo[]>(IpcChannels.backup.list),
    createManual: () => invoke<BackupInfo>(IpcChannels.backup.createManual),
    restore: (filePath: string) => invoke<void>(IpcChannels.backup.restore, filePath),
    delete: (filePath: string) => invoke<void>(IpcChannels.backup.delete, filePath),
    chooseRestoreFile: () => invoke<string | null>(IpcChannels.backup.chooseRestoreFile),
    openBackupsFolder: () => invoke<void>(IpcChannels.backup.openBackupsFolder),
  },
  settings: {
    get: () => invoke<Settings>(IpcChannels.settings.get),
    update: (partial: Partial<Settings>) => invoke<Settings>(IpcChannels.settings.update, partial),
  },
  system: {
    getLogPath: () => invoke<string | null>(IpcChannels.system.getLogPath),
  },
};

export type InventoryApi = typeof api;

contextBridge.exposeInMainWorld("api", api);
