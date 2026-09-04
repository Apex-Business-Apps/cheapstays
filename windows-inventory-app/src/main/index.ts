import { app, BrowserWindow, Menu } from "electron";
import path from "node:path";
import { openDatabase, closeDatabase } from "./db/database";
import { getDatabaseFilePath } from "./paths";
import { initLogger, logger } from "./logger";
import { registerIpcHandlers } from "./ipc/handlers";
import { startScheduledBackups, stopScheduledBackups } from "./services/backupService";

// `!app.isPackaged` alone is true for ANY unpackaged run, including running
// the built dist/main/index.js directly (e.g. for a smoke test) — NODE_ENV
// lets that case opt into loading the built renderer files instead of the
// Vite dev server, without affecting the real packaged app (isPackaged is
// simply true there regardless of NODE_ENV).
const isDev = !app.isPackaged && process.env.NODE_ENV !== "production";

// Single-instance lock — a second launch just focuses the existing window
// instead of opening a second connection to the same SQLite file.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  app.whenReady().then(async () => {
    initLogger(app.getPath("userData"));
    logger.info("Application starting", { version: app.getVersion(), isDev });

    try {
      openDatabase(getDatabaseFilePath());
    } catch (err) {
      logger.error("Failed to open database", err);
      app.quit();
      return;
    }

    registerIpcHandlers();
    startScheduledBackups();
    Menu.setApplicationMenu(null);
    createMainWindow();

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });

  app.on("window-all-closed", () => {
    stopScheduledBackups();
    closeDatabase();
    if (process.platform !== "darwin") app.quit();
  });

  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
  });
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", reason);
  });
}

function createMainWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#f7f8fa",
    title: "Inventory Manager",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL("http://localhost:5183");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
  }
}
