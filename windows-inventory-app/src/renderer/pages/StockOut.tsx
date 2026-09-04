import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { Modal, ConfirmDialog } from "../components/Modal";
import { ProductPicker } from "../components/ProductPicker";
import { formatQuantity } from "../../shared/money";
import { monthOptions, currentYear, todayIso } from "../lib/dateHelpers";
import type { Product, StockOut as StockOutRecord, StockOutInput, StockOutReason } from "../../shared/types";

const REASON_LABELS: Record<StockOutReason, string> = {
  sale: "Продажба",
  waste: "Брак",
  return: "Връщане на доставчик",
  other: "Друго",
};

function StockOutForm({
  products,
  initial,
  onSubmit,
  onCancel,
}: {
  products: Product[];
  initial?: StockOutRecord;
  onSubmit: (input: StockOutInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [productId, setProductId] = useState<number | null>(initial?.productId ?? null);
  const [movementDate, setMovementDate] = useState(initial?.movementDate ?? todayIso());
  const [quantity, setQuantity] = useState(initial ? String(initial.quantityMilli / 1000) : "");
  const [reason, setReason] = useState<StockOutReason>(initial?.reason ?? "sale");
  const [note, setNote] = useState(initial?.note ?? "");
  const [currentStock, setCurrentStock] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  useEffect(() => {
    if (!productId) {
      setCurrentStock(null);
      return;
    }
    api.products.currentStock(productId).then((milli) => setCurrentStock(milli / 1000));
  }, [productId]);

  const product = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) {
      show("Изберете продукт.", "error");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ productId, movementDate, quantity: parseFloat(quantity) || 0, reason, note });
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Продукт</label>
        <ProductPicker products={products} value={productId} onChange={setProductId} />
        {product && currentStock !== null && (
          <div className="text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            Текуща наличност: {formatQuantity(currentStock * 1000, product.unit)}
          </div>
        )}
      </div>
      <div className="field-row">
        <div className="field">
          <label>Дата</label>
          <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} required />
        </div>
        <div className="field">
          <label>Количество {product ? `(${product.unit === "kg" ? "кг." : "бр."})` : ""}</label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Причина</label>
          <select value={reason} onChange={(e) => setReason(e.target.value as StockOutReason)}>
            {Object.entries(REASON_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="field">
        <label>Бележка (по избор)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Отказ
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Запазване…" : "Запази"}
        </button>
      </div>
    </form>
  );
}

export default function StockOut() {
  const [items, setItems] = useState<StockOutRecord[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [year, setYear] = useState<number | "">(currentYear());
  const [month, setMonth] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | StockOutRecord | null>(null);
  const [toDelete, setToDelete] = useState<StockOutRecord | null>(null);
  const { show } = useToast();

  async function load() {
    try {
      const [outs, prod] = await Promise.all([
        api.stockOuts.list({ year: year || undefined, month: month || undefined, search: search || undefined }),
        api.products.list({}),
      ]);
      setItems(outs);
      setProducts(prod);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, search]);

  async function handleCreate(input: StockOutInput) {
    await api.stockOuts.create(input);
    show("Изписването е записано.", "success");
    setModal(null);
    load();
  }

  async function handleUpdate(id: number, input: StockOutInput) {
    await api.stockOuts.update(id, input);
    show("Изписването е обновено.", "success");
    setModal(null);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api.stockOuts.delete(toDelete.id);
      show("Записът е изтрит.", "success");
      setToDelete(null);
      load();
    } catch (err) {
      show(errorMessage(err), "error");
      setToDelete(null);
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="search-input-wrap">
          <span className="icon">🔍</span>
          <input type="text" placeholder="Търсене по продукт…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select value={year} onChange={(e) => setYear(e.target.value ? Number(e.target.value) : "")} style={{ width: 120 }}>
          <option value="">Всички години</option>
          {[currentYear() + 1, currentYear(), currentYear() - 1, currentYear() - 2].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value ? Number(e.target.value) : "")} style={{ width: 150 }}>
          <option value="">Всички месеци</option>
          {monthOptions().map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setModal("create")}>
          + Ново изписване
        </button>
      </div>

      <div className="table-wrap">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📤</div>
            Няма записани изписвания.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Дата</th>
                <th>Продукт</th>
                <th className="num">Количество</th>
                <th>Причина</th>
                <th>Бележка</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.movementDate}</td>
                  <td>{item.productName}</td>
                  <td className="num">{formatQuantity(item.quantityMilli, item.unit)}</td>
                  <td>{REASON_LABELS[item.reason]}</td>
                  <td className="text-muted">{item.note ?? "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm" onClick={() => setModal(item)}>
                        Редактирай
                      </button>
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => setToDelete(item)}>
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

      {modal === "create" && (
        <Modal title="Ново изписване" onClose={() => setModal(null)}>
          <StockOutForm products={products} onSubmit={handleCreate} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== "create" && (
        <Modal title="Редактирай изписване" onClose={() => setModal(null)}>
          <StockOutForm products={products} initial={modal} onSubmit={(input) => handleUpdate(modal.id, input)} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Изтриване на запис"
          message={`Сигурни ли сте, че искате да изтриете това изписване на „${toDelete.productName}“?`}
          confirmLabel="Изтрий"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
