import path from "node:path";

/**
 * All user data (database, backups, logs) lives under the OS-standard
 * per-user app-data directory — never inside the installation directory,
 * which may be read-only under a standard (non-admin) Windows install
 * (spec §32).
 *   Windows: %APPDATA%\Inventory Manager
 *   Linux (dev/test): ~/.config/Inventory Manager
 *
 * `electron` is required lazily (not imported at module top) so this file
 * can be imported by plain-Node unit tests without an Electron runtime —
 * the electron package resolves to a binary path string outside of one,
 * and none of these functions are called by tests without an override.
 */
function getElectronApp(): Electron.App {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const electron = require("electron") as typeof Electron;
  return electron.app;
}

export function getUserDataDir(): string {
  return getElectronApp().getPath("userData");
}

export function getDatabaseFilePath(): string {
  return path.join(getUserDataDir(), "inventory.db");
}

export function getBackupsDir(): string {
  return path.join(getUserDataDir(), "Backups");
}

/** Bundled read-only assets (fonts for PDF export). Resolves correctly both in dev and in a packaged build. */
export function getResourcesDir(): string {
  const app = getElectronApp();
  if (app.isPackaged) {
    return process.resourcesPath;
  }
  // In dev, __dirname is dist/main; the project's resources/ dir sits next to src/.
  return path.join(__dirname, "..", "..", "resources");
}

export function getFontPath(fileName: string): string {
  return path.join(getResourcesDir(), "fonts", fileName);
}
