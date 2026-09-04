import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

let dbInstance: Database.Database | null = null;
let dbFilePath: string | null = null;

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

function runMigrations(db: Database.Database): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)"
  );
  const applied = new Set(
    (db.prepare("SELECT name FROM schema_migrations").all() as { name: string }[]).map((r) => r.name)
  );
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const insertMigration = db.prepare(
    "INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)"
  );

  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    const applyMigration = db.transaction(() => {
      db.exec(sql);
      insertMigration.run(file, new Date().toISOString());
    });
    applyMigration();
  }
}

/**
 * SQLite's built-in COLLATE NOCASE and the LIKE operator only case-fold
 * ASCII (A-Z/a-z) — they leave Cyrillic case pairs (e.g. "Д" vs "д") alone,
 * which would silently break duplicate-name detection and search for every
 * Bulgarian product/supplier/invoice name. `bg_lower` is a real function
 * (backed by JS's locale-aware toLowerCase, which does fold Cyrillic
 * correctly) registered on every connection and used everywhere the schema
 * or the service layer needs case-insensitive comparison — including as the
 * basis of the case-insensitive unique indexes below, so it must be
 * registered before migrations run.
 */
function registerCollationHelpers(db: Database.Database): void {
  db.function("bg_lower", { deterministic: true }, (value: unknown) =>
    typeof value === "string" ? value.toLowerCase() : value
  );
}

export function openDatabase(filePath: string): Database.Database {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  registerCollationHelpers(db);
  runMigrations(db);

  dbInstance = db;
  dbFilePath = filePath;
  return db;
}

export function getDb(): Database.Database {
  if (!dbInstance) throw new Error("Database has not been initialized yet");
  return dbInstance;
}

export function getDbFilePath(): string {
  if (!dbFilePath) throw new Error("Database has not been initialized yet");
  return dbFilePath;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    dbFilePath = null;
  }
}

/** Re-opens the same file path (used after a restore-from-backup). */
export function reopenDatabase(): Database.Database {
  const filePath = dbFilePath;
  if (!filePath) throw new Error("Database has not been initialized yet");
  closeDatabase();
  return openDatabase(filePath);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
