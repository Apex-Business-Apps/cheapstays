import { getDb } from "../db/database";
import type { Settings } from "../../shared/types";

const DEFAULTS: Settings = {
  autoBackupEnabled: true,
  autoBackupIntervalDays: 3,
  lastAutoBackupAt: null,
  companyName: "JGP Corporation",
};

function getRaw(key: string): string | null {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setRaw(key: string, value: string): void {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    )
    .run(key, value);
}

export function getSettings(): Settings {
  return {
    autoBackupEnabled: (getRaw("autoBackupEnabled") ?? String(DEFAULTS.autoBackupEnabled)) === "true",
    autoBackupIntervalDays: Number(getRaw("autoBackupIntervalDays") ?? DEFAULTS.autoBackupIntervalDays),
    lastAutoBackupAt: getRaw("lastAutoBackupAt"),
    companyName: getRaw("companyName") ?? DEFAULTS.companyName,
  };
}

export function updateSettings(partial: Partial<Settings>): Settings {
  if (partial.autoBackupEnabled !== undefined) setRaw("autoBackupEnabled", String(partial.autoBackupEnabled));
  if (partial.autoBackupIntervalDays !== undefined)
    setRaw("autoBackupIntervalDays", String(partial.autoBackupIntervalDays));
  if (partial.lastAutoBackupAt !== undefined && partial.lastAutoBackupAt !== null)
    setRaw("lastAutoBackupAt", partial.lastAutoBackupAt);
  if (partial.companyName !== undefined) setRaw("companyName", partial.companyName);
  return getSettings();
}
