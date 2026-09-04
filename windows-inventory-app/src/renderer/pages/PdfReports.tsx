import React, { useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { monthOptions, currentYear, currentMonth, todayIso } from "../lib/dateHelpers";

export default function PdfReports() {
  const { show } = useToast();
  const [monthYear, setMonthYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [yearOnly, setYearOnly] = useState(currentYear());
  const [from, setFrom] = useState(todayIso().slice(0, 8) + "01");
  const [to, setTo] = useState(todayIso());
  const [busy, setBusy] = useState<string | null>(null);

  async function exportMonthly() {
    setBusy("monthly");
    try {
      const path = await api.pdf.exportMonthly(monthYear, month);
      if (path) show(`PDF файлът е записан: ${path}`, "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function exportYearly() {
    setBusy("yearly");
    try {
      const path = await api.pdf.exportYearly(yearOnly);
      if (path) show(`PDF файлът е записан: ${path}`, "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function exportCustom() {
    if (from > to) {
      show("Началната дата трябва да е преди крайната.", "error");
      return;
    }
    setBusy("custom");
    try {
      const path = await api.pdf.exportCustom(from, to);
      if (path) show(`PDF файлът е записан: ${path}`, "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <div className="card">
        <h3 className="mt-0">Месечен отчет</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Складов отчет за избран месец — начално, получено, изход и крайна наличност по продукти.
        </p>
        <div className="field-row">
          <div className="field">
            <label>Година</label>
            <select value={monthYear} onChange={(e) => setMonthYear(Number(e.target.value))}>
              {[currentYear() + 1, currentYear(), currentYear() - 1, currentYear() - 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Месец</label>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {monthOptions().map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button className="btn btn-primary" onClick={exportMonthly} disabled={busy === "monthly"}>
          📄 {busy === "monthly" ? "Генериране…" : "Експортирай PDF"}
        </button>
      </div>

      <div className="card">
        <h3 className="mt-0">Годишен отчет</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Обобщен складов отчет за цялата година.
        </p>
        <div className="field" style={{ maxWidth: 200 }}>
          <label>Година</label>
          <select value={yearOnly} onChange={(e) => setYearOnly(Number(e.target.value))}>
            {[currentYear() + 1, currentYear(), currentYear() - 1, currentYear() - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-primary" onClick={exportYearly} disabled={busy === "yearly"}>
          📄 {busy === "yearly" ? "Генериране…" : "Експортирай PDF"}
        </button>
      </div>

      <div className="card">
        <h3 className="mt-0">Отчет за избран период</h3>
        <p className="text-muted" style={{ marginTop: 0 }}>
          Изберете произволен период (напр. 01.09.2026 – 15.09.2026).
        </p>
        <div className="field-row">
          <div className="field">
            <label>От дата</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>До дата</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={exportCustom} disabled={busy === "custom"}>
          📄 {busy === "custom" ? "Генериране…" : "Експортирай PDF"}
        </button>
      </div>
    </div>
  );
}
