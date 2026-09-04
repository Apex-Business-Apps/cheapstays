import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/Modal";
import type { BackupInfo } from "../../shared/types";

const KIND_LABELS: Record<BackupInfo["kind"], string> = {
  manual: "Ръчен",
  scheduled: "Автоматичен",
  pre_restore: "Предпазен (преди възстановяване)",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function Backup() {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [pendingRestore, setPendingRestore] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BackupInfo | null>(null);
  const { show } = useToast();

  async function load() {
    try {
      setBackups(await api.backup.list());
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleManualBackup() {
    setBusy(true);
    try {
      const info = await api.backup.createManual();
      show(`Backup „${info.fileName}“ е създаден успешно.`, "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function handleChooseRestore() {
    try {
      const filePath = await api.backup.chooseRestoreFile();
      if (filePath) setPendingRestore(filePath);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  async function handleRestoreFromRow(filePath: string) {
    setPendingRestore(filePath);
  }

  async function confirmRestore() {
    if (!pendingRestore) return;
    setBusy(true);
    try {
      await api.backup.restore(pendingRestore);
      show("Базата данни е възстановена успешно.", "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(false);
      setPendingRestore(null);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    try {
      await api.backup.delete(pendingDelete.filePath);
      show("Backup файлът е изтрит.", "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setPendingDelete(null);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <button className="btn btn-primary" onClick={handleManualBackup} disabled={busy}>
          💾 {busy ? "Изчакайте…" : "Направи backup сега"}
        </button>
        <button className="btn" onClick={handleChooseRestore}>
          ♻️ Възстановяване от backup
        </button>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={() => api.backup.openBackupsFolder()}>
          📂 Отвори папката с backups
        </button>
      </div>

      <p className="text-muted" style={{ marginTop: -6 }}>
        Автоматичен backup се прави на всеки 3 дни, ако приложението е стартирано. Ръчен backup можете да направите по всяко време.
      </p>

      <div className="table-wrap">
        {backups.length === 0 ? (
          <div className="empty-state">
            <div className="icon">💾</div>
            Все още няма направени backup файлове.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Файл</th>
                <th>Вид</th>
                <th className="num">Размер</th>
                <th>Дата</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {backups.map((b) => (
                <tr key={b.filePath}>
                  <td>{b.fileName}</td>
                  <td>
                    <span className={`badge ${b.kind === "manual" ? "badge-success" : b.kind === "scheduled" ? "badge-muted" : "badge-warning"}`}>
                      {KIND_LABELS[b.kind]}
                    </span>
                  </td>
                  <td className="num">{formatSize(b.fileSizeBytes)}</td>
                  <td>{new Date(b.createdAt).toLocaleString("bg-BG")}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm" onClick={() => handleRestoreFromRow(b.filePath)}>
                        Възстанови
                      </button>
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => setPendingDelete(b)}>
                        Изтрий
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {pendingRestore && (
        <ConfirmDialog
          title="Възстановяване от backup"
          message="Сигурни ли сте? Текущата база данни ще бъде заменена с избрания backup файл. Преди това автоматично ще бъде направен предпазен backup на текущите данни."
          confirmLabel="Възстанови"
          danger
          onConfirm={confirmRestore}
          onCancel={() => setPendingRestore(null)}
        />
      )}
      {pendingDelete && (
        <ConfirmDialog
          title="Изтриване на backup"
          message={`Сигурни ли сте, че искате да изтриете „${pendingDelete.fileName}“?`}
          confirmLabel="Изтрий"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
