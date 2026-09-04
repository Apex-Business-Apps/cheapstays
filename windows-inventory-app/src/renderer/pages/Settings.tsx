import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import type { AuditLogEntry, Settings as SettingsType } from "../../shared/types";

export default function Settings() {
  const [settings, setSettings] = useState<SettingsType | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [auditSearch, setAuditSearch] = useState("");
  const [logPath, setLogPath] = useState<string | null>(null);
  const { show } = useToast();

  async function loadSettings() {
    try {
      setSettings(await api.settings.get());
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  async function loadAudit(query: string) {
    try {
      const entries = query.trim() ? await api.audit.search(query, 100) : await api.audit.list(100);
      setAuditEntries(entries);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    loadSettings();
    loadAudit("");
    api.system.getLogPath().then(setLogPath);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => loadAudit(auditSearch), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditSearch]);

  async function saveSettings(partial: Partial<SettingsType>) {
    try {
      const updated = await api.settings.update(partial);
      setSettings(updated);
      show("Настройките са запазени.", "success");
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  if (!settings) return <div className="text-muted">Зареждане…</div>;

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
      <div className="card">
        <h3 className="mt-0">Компания</h3>
        <div className="field" style={{ maxWidth: 360 }}>
          <label>Име на фирмата (за PDF отчетите)</label>
          <input
            type="text"
            defaultValue={settings.companyName}
            onBlur={(e) => e.target.value !== settings.companyName && saveSettings({ companyName: e.target.value })}
          />
        </div>
      </div>

      <div className="card">
        <h3 className="mt-0">Автоматичен backup</h3>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500, color: "var(--text)" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={settings.autoBackupEnabled}
            onChange={(e) => saveSettings({ autoBackupEnabled: e.target.checked })}
          />
          Автоматичен backup на всеки
          <select
            style={{ width: 90 }}
            value={settings.autoBackupIntervalDays}
            onChange={(e) => saveSettings({ autoBackupIntervalDays: Number(e.target.value) })}
          >
            {[1, 2, 3, 5, 7, 14].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          дни
        </label>
        {settings.lastAutoBackupAt && (
          <p className="text-muted" style={{ fontSize: 12.5 }}>
            Последен автоматичен backup: {new Date(settings.lastAutoBackupAt).toLocaleString("bg-BG")}
          </p>
        )}
      </div>

      <div className="card">
        <h3 className="mt-0">Диагностика</h3>
        <p className="text-muted" style={{ fontSize: 12.5, wordBreak: "break-all" }}>
          Лог файл: {logPath ?? "—"}
        </p>
      </div>

      <div className="card">
        <h3 className="mt-0">История на действията</h3>
        <div className="search-input-wrap" style={{ marginBottom: 12 }}>
          <span className="icon">🔍</span>
          <input type="text" placeholder="Търсене в историята…" value={auditSearch} onChange={(e) => setAuditSearch(e.target.value)} />
        </div>
        {auditEntries.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🕊️</div>
            Няма записи.
          </div>
        ) : (
          <div className="activity-list" style={{ maxHeight: 420, overflowY: "auto" }}>
            {auditEntries.map((entry) => (
              <div className="activity-item" key={entry.id}>
                <span className="dot" />
                <div>
                  <div className="desc">{entry.description}</div>
                  <div className="time">{new Date(entry.createdAt).toLocaleString("bg-BG")}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
