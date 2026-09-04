import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import { IpcChannels } from "../../shared/ipcChannels";
import { toApiError } from "../errors";
import { logger } from "../logger";
import { getBackupsDir } from "../paths";
import * as productService from "../services/productService";
import * as supplierService from "../services/supplierService";
import * as invoiceService from "../services/invoiceService";
import * as stockOutService from "../services/stockOutService";
import * as stockService from "../services/stockService";
import * as periodService from "../services/periodService";
import * as dashboardService from "../services/dashboardService";
import * as auditService from "../services/auditService";
import * as pdfService from "../services/pdfService";
import * as backupService from "../services/backupService";
import * as settingsService from "../services/settingsService";
import { getLogFilePath } from "../logger";
import type { ApiResult } from "../../shared/types";

function showSaveDialog(options: Electron.SaveDialogOptions): Promise<Electron.SaveDialogReturnValue> {
  const win = BrowserWindow.getFocusedWindow();
  return win ? dialog.showSaveDialog(win, options) : dialog.showSaveDialog(options);
}

function showOpenDialog(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  const win = BrowserWindow.getFocusedWindow();
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options);
}

function handle<TArgs extends unknown[], TResult>(
  channel: string,
  fn: (...args: TArgs) => TResult | Promise<TResult>
): void {
  ipcMain.handle(channel, async (_event, ...args: TArgs): Promise<ApiResult<TResult>> => {
    try {
      const data = await fn(...args);
      return { ok: true, data };
    } catch (err) {
      logger.error(`IPC ${channel} failed`, err);
      return { ok: false, error: toApiError(err) };
    }
  });
}

export function registerIpcHandlers(): void {
  // Products
  handle(IpcChannels.products.list, productService.listProducts);
  handle(IpcChannels.products.get, productService.getProduct);
  handle(IpcChannels.products.create, productService.createProduct);
  handle(IpcChannels.products.update, productService.updateProduct);
  handle(IpcChannels.products.setActive, productService.setProductActive);
  handle(IpcChannels.products.delete, productService.deleteProduct);
  handle(IpcChannels.products.currentStock, productService.getProductCurrentStock);

  // Suppliers
  handle(IpcChannels.suppliers.list, supplierService.listSuppliers);

  // Invoices
  handle(IpcChannels.invoices.list, invoiceService.listInvoices);
  handle(IpcChannels.invoices.get, invoiceService.getInvoice);
  handle(IpcChannels.invoices.create, invoiceService.createInvoice);
  handle(IpcChannels.invoices.update, invoiceService.updateInvoice);
  handle(IpcChannels.invoices.delete, invoiceService.deleteInvoice);

  // Stock outs
  handle(IpcChannels.stockOuts.list, stockOutService.listStockOuts);
  handle(IpcChannels.stockOuts.get, stockOutService.getStockOut);
  handle(IpcChannels.stockOuts.create, stockOutService.createStockOut);
  handle(IpcChannels.stockOuts.update, stockOutService.updateStockOut);
  handle(IpcChannels.stockOuts.delete, stockOutService.deleteStockOut);

  // Inventory reports
  handle(IpcChannels.inventory.monthlyReport, stockService.getMonthlyInventoryReport);
  handle(IpcChannels.inventory.rangeReport, stockService.getInventoryReportForRange);

  // Periods
  handle(IpcChannels.periods.listYears, periodService.listYearsWithData);
  handle(IpcChannels.periods.list, periodService.listPeriods);
  handle(IpcChannels.periods.status, periodService.getPeriodStatus);
  handle(IpcChannels.periods.close, periodService.closePeriod);
  handle(IpcChannels.periods.reopen, periodService.reopenPeriod);

  // Dashboard
  handle(IpcChannels.dashboard.stats, dashboardService.getDashboardStats);

  // Audit
  handle(IpcChannels.audit.list, auditService.listAuditLog);
  handle(IpcChannels.audit.search, auditService.searchAuditLog);

  // PDF export — always via a native "Save As" dialog so the user picks the destination.
  handle(IpcChannels.pdf.exportMonthly, async (year: number, month: number) => {
    const defaultPath = pdfService.suggestedMonthlyFileName(year, month);
    const result = await showSaveDialog({
      title: "Експортирай PDF",
      defaultPath,
      filters: [{ name: "PDF файлове", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await pdfService.exportMonthlyReportPdf(year, month, result.filePath);
    return result.filePath;
  });

  handle(IpcChannels.pdf.exportYearly, async (year: number) => {
    const defaultPath = pdfService.suggestedYearlyFileName(year);
    const result = await showSaveDialog({
      title: "Експортирай PDF",
      defaultPath,
      filters: [{ name: "PDF файлове", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await pdfService.exportYearlyReportPdf(year, result.filePath);
    return result.filePath;
  });

  handle(IpcChannels.pdf.exportCustom, async (from: string, to: string) => {
    const defaultPath = pdfService.suggestedCustomFileName(from, to);
    const result = await showSaveDialog({
      title: "Експортирай PDF",
      defaultPath,
      filters: [{ name: "PDF файлове", extensions: ["pdf"] }],
    });
    if (result.canceled || !result.filePath) return null;
    await pdfService.exportCustomPeriodReportPdf(from, to, result.filePath);
    return result.filePath;
  });

  // Backups
  handle(IpcChannels.backup.list, backupService.listBackups);
  handle(IpcChannels.backup.createManual, () => backupService.createBackup("manual"));
  handle(IpcChannels.backup.restore, backupService.restoreFromBackup);
  handle(IpcChannels.backup.delete, backupService.deleteBackup);
  handle(IpcChannels.backup.chooseRestoreFile, async () => {
    const result = await showOpenDialog({
      title: "Изберете backup файл",
      defaultPath: getBackupsDir(),
      properties: ["openFile"],
      filters: [{ name: "Backup файлове", extensions: ["db"] }],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
  handle(IpcChannels.backup.openBackupsFolder, async () => {
    await shell.openPath(getBackupsDir());
  });

  // Settings
  handle(IpcChannels.settings.get, settingsService.getSettings);
  handle(IpcChannels.settings.update, settingsService.updateSettings);

  // System
  handle(IpcChannels.system.getLogPath, () => getLogFilePath());
}
