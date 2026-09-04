import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { formatMoneyBGN, formatQuantity } from "../../shared/money";
import { currentYear } from "../lib/dateHelpers";
import type { InventoryRow } from "../../shared/types";

export default function YearlyReports() {
  const [year, setYear] = useState(currentYear());
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [years, setYears] = useState<number[]>([currentYear()]);
  const { show } = useToast();

  useEffect(() => {
    api.periods.listYears().then(setYears).catch(() => {});
  }, []);

  useEffect(() => {
    api.inventory
      .rangeReport(`${year}-01-01`, `${year}-12-31`)
      .then(setRows)
      .catch((err) => show(errorMessage(err), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  const totalValue = rows.reduce((s, r) => s + r.valuationCents, 0);

  return (
    <div>
      <div className="toolbar">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ width: 120 }}>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="page-header">
        <div>
          <h2>Годишен отчет {year}</h2>
          <div className="subtitle">Наличности за периода 01.01.{year} – 31.12.{year}</div>
        </div>
      </div>

      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📈</div>
            Няма данни за {year} г.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Мярка</th>
                <th className="num">Начално (01.01)</th>
                <th className="num">Получено</th>
                <th className="num">Изход</th>
                <th className="num">Крайно (31.12)</th>
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
    </div>
  );
}
