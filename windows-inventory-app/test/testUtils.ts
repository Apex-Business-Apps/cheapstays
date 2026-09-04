import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, closeDatabase } from "../src/main/db/database";

let currentDir: string | null = null;

export function setupTestDb(): void {
  currentDir = fs.mkdtempSync(path.join(os.tmpdir(), "inventory-test-"));
  openDatabase(path.join(currentDir, "test.db"));
}

export function teardownTestDb(): void {
  closeDatabase();
  if (currentDir && fs.existsSync(currentDir)) {
    fs.rmSync(currentDir, { recursive: true, force: true });
  }
  currentDir = null;
}

export function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export const FONTS_DIR = path.join(__dirname, "..", "resources", "fonts");
