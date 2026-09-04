import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, getDbFilePath, closeDatabase, openDatabase, nowIso } from "../db/database";
import { getBackupsDir as getDefaultBackupsDir } from "../paths";
import { logAudit } from "./auditService";
import { getSettings, updateSettings } from "./settingsService";
import { Errors } from "../errors";
import type { BackupInfo } from "../../shared/types";

// The backups directory defaults to the OS user-data location (paths.ts,
// which needs a running Electron app). Every function accepts an optional
// override so the same logic is exercised directly in unit tests against a
// plain temp directory, with no Electron runtime involved.

function timestampForFileName(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
}

function ensureBackupsDir(dir: string): string {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Flushes WAL into the main .db file so a plain file copy is a consistent snapshot. */
function checkpointDatabase(): void {
  getDb().pragma("wal_checkpoint(TRUNCATE)");
}

function recordBackupRow(filePath: string, kind: BackupInfo["kind"]): void {
  const stat = fs.statSync(filePath);
  getDb()
    .prepare("INSERT INTO backups (file_path, file_size_bytes, kind, created_at) VALUES (?, ?, ?, ?)")
    .run(filePath, stat.size, kind, nowIso());
}

export function createBackup(kind: BackupInfo["kind"] = "manual", backupsDir: string = getDefaultBackupsDir()): BackupInfo {
  checkpointDatabase();
  const dir = ensureBackupsDir(backupsDir);
  // The random suffix guarantees a unique file name even when two backups
  // (e.g. a manual one immediately followed by an automatic pre_restore
  // safety backup) happen within the same second — without it the second
  // write would silently clobber the first backup file on disk.
  const uniqueSuffix = crypto.randomBytes(3).toString("hex");
  // `kind` is encoded in the filename (not just the `backups` table row) so
  // the Backup screen can still label a file correctly after a restore —
  // restoring intentionally replaces the whole database file, `backups`
  // table included, which would otherwise erase the very row describing the
  // pre-restore safety backup that operation just took.
  const fileName = `backup_${kind}_${timestampForFileName()}_${uniqueSuffix}.db`;
  const filePath = path.join(dir, fileName);
  fs.copyFileSync(getDbFilePath(), filePath);
  recordBackupRow(filePath, kind);

  if (kind === "scheduled") {
    updateSettings({ lastAutoBackupAt: nowIso() });
  }

  logAudit(
    "backup",
    null,
    "backup",
    `Направен ${kind === "manual" ? "ръчен" : kind === "scheduled" ? "автоматичен" : "предпазен"} backup: ${fileName}`
  );

  const stat = fs.statSync(filePath);
  return { fileName, filePath, fileSizeBytes: stat.size, createdAt: nowIso(), kind };
}

const KIND_FROM_FILENAME = /^backup_(manual|scheduled|pre_restore)_/;

export function listBackups(backupsDir: string = getDefaultBackupsDir()): BackupInfo[] {
  const dir = ensureBackupsDir(backupsDir);
  const rows = getDb()
    .prepare("SELECT file_path as filePath, kind FROM backups ORDER BY id DESC")
    .all() as { filePath: string; kind: BackupInfo["kind"] }[];
  const kindByPath = new Map(rows.map((r) => [r.filePath, r.kind]));

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".db"))
    .map((f) => path.join(dir, f));

  const infos: BackupInfo[] = files.map((filePath) => {
    const stat = fs.statSync(filePath);
    const fromName = KIND_FROM_FILENAME.exec(path.basename(filePath))?.[1] as BackupInfo["kind"] | undefined;
    return {
      fileName: path.basename(filePath),
      filePath,
      fileSizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
      kind: fromName ?? kindByPath.get(filePath) ?? "manual",
    };
  });

  return infos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Restores the database from a backup file. Always takes a fresh
 * "pre_restore" safety backup of the current database first, then swaps the
 * file in and reopens the connection so the running app picks up the
 * restored data immediately without needing a full relaunch.
 */
export function restoreFromBackup(backupFilePath: string, backupsDir: string = getDefaultBackupsDir()): void {
  const dir = ensureBackupsDir(backupsDir);
  const resolvedPath = path.resolve(backupFilePath);
  const resolvedDir = path.resolve(dir);
  if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
    throw Errors.validation("Невалиден backup файл.");
  }
  if (!fs.existsSync(resolvedPath)) {
    throw Errors.notFound("Backup файлът");
  }

  const dbPath = getDbFilePath();
  createBackup("pre_restore", backupsDir);

  // The live connection MUST be closed before the file underneath it is
  // swapped: a still-open WAL connection can otherwise write its own
  // (stale, in-memory) state back over our freshly-copied file the moment
  // it is closed, silently discarding the restore. Closing first, copying
  // while nothing holds the file open, then opening fresh is the only
  // ordering that is actually safe.
  closeDatabase();
  fs.copyFileSync(resolvedPath, dbPath);
  // Drop any leftover WAL/SHM files so the restored file alone is authoritative.
  for (const ext of ["-wal", "-shm"]) {
    const sidecar = dbPath + ext;
    if (fs.existsSync(sidecar)) fs.rmSync(sidecar);
  }
  openDatabase(dbPath);

  logAudit("restore", null, "restore", `Възстановена база данни от ${path.basename(resolvedPath)}`);
}

export function deleteBackup(backupFilePath: string, backupsDir: string = getDefaultBackupsDir()): void {
  const dir = ensureBackupsDir(backupsDir);
  const resolvedPath = path.resolve(backupFilePath);
  const resolvedDir = path.resolve(dir);
  if (!resolvedPath.startsWith(resolvedDir + path.sep)) {
    throw Errors.validation("Невалиден backup файл.");
  }
  if (fs.existsSync(resolvedPath)) fs.rmSync(resolvedPath);
  getDb().prepare("DELETE FROM backups WHERE file_path = ?").run(resolvedPath);
}

let scheduledTimer: NodeJS.Timeout | null = null;

export function startScheduledBackups(): void {
  if (scheduledTimer) clearInterval(scheduledTimer);
  const check = () => {
    const settings = getSettings();
    if (!settings.autoBackupEnabled) return;
    const intervalMs = settings.autoBackupIntervalDays * 24 * 60 * 60 * 1000;
    const last = settings.lastAutoBackupAt ? new Date(settings.lastAutoBackupAt).getTime() : 0;
    if (Date.now() - last >= intervalMs) {
      createBackup("scheduled");
    }
  };
  // Check shortly after launch, then once every hour — cheap and catches the
  // 3-day boundary promptly even if the app isn't left running continuously.
  setTimeout(check, 10_000);
  scheduledTimer = setInterval(check, 60 * 60 * 1000);
}

export function stopScheduledBackups(): void {
  if (scheduledTimer) {
    clearInterval(scheduledTimer);
    scheduledTimer = null;
  }
}
