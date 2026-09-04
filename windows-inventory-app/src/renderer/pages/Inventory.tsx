import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { formatMoneyBGN, formatQuantity } from "../../shared/money";
import { monthOptions, currentYear, currentMonth } from "../lib/dateHelpers";
import type { InventoryRow } from "../../shared/types";

export default function Inventory() {
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const { show } = useToast();

  useEffect(() => {
    api.inventory
      .monthlyReport(year, month)
      .then(setRows)
      .catch((err) => show(errorMessage(err), "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const filtered = rows.filter((r) => r.productName.toLowerCase().includes(search.trim().toLowerCase()));
  const totalValue = filtered.reduce((s, r) => s + r.valuationCents, 0);

  return (
    <div>
      <div className="toolbar">
        <div className="search-input-wrap">
          <span className="icon">🔍</span>
          <input type="text" placeholder="Търсене на продукт…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
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
      </div>

      <div className="table-wrap">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📊</div>
            Няма данни за избрания период.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Мерна единица</th>
                <th className="num">Начално</th>
                <th className="num">Получено</th>
                <th className="num">Изход</th>
                <th className="num">Крайно</th>
                <th className="num">Стойност</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
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
