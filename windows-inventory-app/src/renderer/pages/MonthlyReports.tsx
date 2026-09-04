import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { ConfirmDialog } from "../components/Modal";
import { formatMoneyBGN, formatQuantity } from "../../shared/money";
import { monthOptions, monthLabel, currentYear, currentMonth } from "../lib/dateHelpers";
import type { InventoryRow, Period } from "../../shared/types";

export default function MonthlyReports() {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [period, setPeriod] = useState<Period | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const { show } = useToast();

  async function load() {
    try {
      const [reportRows, periodStatus] = await Promise.all([
        api.inventory.monthlyReport(year, month),
        api.periods.status({ year, month }),
      ]);
      setRows(reportRows);
      setPeriod(periodStatus);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  async function handleClose() {
    try {
      const updated = await api.periods.close({ year, month });
      setPeriod(updated);
      show(`Месец ${monthLabel(month)} ${year} е приключен.`, "success");
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setConfirmClose(false);
    }
  }

  async function handleReopen() {
    try {
      const updated = await api.periods.reopen({ year, month });
      setPeriod(updated);
      show(`Месец ${monthLabel(month)} ${year} е отворен отново.`, "success");
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  const totalValue = rows.reduce((s, r) => s + r.valuationCents, 0);

  return (
    <div>
      <div className="toolbar">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 120 }}>
          {[currentYear() + 1, currentYear(), currentYear() - 1, currentYear() - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} style={{ width: 150 }}>
          {monthOptions().map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {period && (
          <span className={`badge ${period.isClosed ? "badge-success" : "badge-warning"}`}>
            {period.isClosed ? `Приключен на ${new Date(period.closedAt!).toLocaleDateString("bg-BG")}` : "Отворен"}
          </span>
        )}
        <div className="spacer" />
        {period?.isClosed ? (
          <button className="btn" onClick={handleReopen}>
            Отвори отново
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => setConfirmClose(true)}>
            Приключи месец
          </button>
        )}
      </div>

      <div className="page-header">
        <div>
          <h2>
            {monthLabel(month)} {year}
          </h2>
          <div className="subtitle">Начална и крайна наличност по продукти за избрания месец</div>
        </div>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📅</div>
            Няма данни за избрания месец.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Мярка</th>
                <th className="num">Начално</th>
                <th className="num">Получено</th>
                <th className="num">Изход</th>
                <th className="num">Крайно</th>
                <th className="num">Стойност</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.productId}>
                  <td>{r.productName}</td>
                  <td>{r.unit === "kg" ? "кг." : "бр."}</td>
                  <td className="num">{formatQuantity(r.openingQty, r.unit)}</td>
                  <td className="num">{formatQuantity(r.receivedQty, r.unit)}</td>
                  <td className="num">{formatQuantity(r.issuedQty, r.unit)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>
                    {formatQuantity(r.closingQty, r.unit)}
                  </td>
                  <td className="num">{formatMoneyBGN(r.valuationCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6} style={{ textAlign: "right", fontWeight: 700, padding: "10px 12px" }}>
                  ОБЩО:
                </td>
                <td className="num" style={{ fontWeight: 700, padding: "10px 12px" }}>
                  {formatMoneyBGN(totalValue)}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {confirmClose && (
        <ConfirmDialog
          title="Приключване на месец"
          message={`Сигурни ли сте, че искате да приключите ${monthLabel(month)} ${year}? Крайната наличност ще бъде записана и ще стане начална наличност за следващия месец.`}
          confirmLabel="Приключи"
          onConfirm={handleClose}
          onCancel={() => setConfirmClose(false)}
        />
      )}
    </div>
  );
}
