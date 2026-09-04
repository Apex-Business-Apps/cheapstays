import React, { useEffect, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { Modal, ConfirmDialog } from "../components/Modal";
import { formatMoneyBGN } from "../../shared/money";
import type { Product, ProductInput, Unit } from "../../shared/types";

function ProductForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Product;
  onSubmit: (input: ProductInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState<Unit>(initial?.unit ?? "kg");
  const [invoicePrice, setInvoicePrice] = useState(initial ? (initial.invoicePriceCents / 100).toFixed(2) : "");
  const [salePrice, setSalePrice] = useState(initial ? (initial.salePriceCents / 100).toFixed(2) : "");
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit({
        name,
        unit,
        invoicePriceCents: Math.round(parseFloat(invoicePrice || "0") * 100),
        salePriceCents: Math.round(parseFloat(salePrice || "0") * 100),
        isActive: initial?.isActive ?? true,
      });
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label>Име на продукта</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
      </div>
      <div className="field-row">
        <div className="field">
          <label>Мерна единица</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
            <option value="kg">кг.</option>
            <option value="pcs">бр.</option>
          </select>
        </div>
        <div className="field">
          <label>Цена по фактура (лв.)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={invoicePrice}
            onChange={(e) => setInvoicePrice(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>Изходна цена (лв.)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            required
          />
        </div>
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

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modal, setModal] = useState<"create" | Product | null>(null);
  const [toDelete, setToDelete] = useState<Product | null>(null);
  const { show } = useToast();

  async function load() {
    try {
      const data = await api.products.list({ includeInactive, search });
      setProducts(data);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive, search]);

  async function handleCreate(input: ProductInput) {
    const p = await api.products.create(input);
    show(`Продукт „${p.name}“ е добавен.`, "success");
    setModal(null);
    load();
  }

  async function handleUpdate(id: number, input: ProductInput) {
    const p = await api.products.update(id, input);
    show(`Продукт „${p.name}“ е обновен.`, "success");
    setModal(null);
    load();
  }

  async function toggleActive(p: Product) {
    try {
      await api.products.setActive(p.id, !p.isActive);
      show(`Продукт „${p.name}“ ${p.isActive ? "деактивиран" : "активиран"}.`, "success");
      load();
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api.products.delete(toDelete.id);
      show(`Продукт „${toDelete.name}“ е изтрит.`, "success");
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
          <input type="text" placeholder="Търсене на продукт…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 500, color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            style={{ width: "auto" }}
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Покажи и неактивните
        </label>
        <div className="spacer" />
        <button className="btn btn-primary" onClick={() => setModal("create")}>
          + Нов продукт
        </button>
      </div>

      <div className="table-wrap">
        {products.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📦</div>
            Няма намерени продукти.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Продукт</th>
                <th>Мярка</th>
                <th className="num">Цена по фактура</th>
                <th className="num">Изходна цена</th>
                <th>Статус</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.unit === "kg" ? "кг." : "бр."}</td>
                  <td className="num">{formatMoneyBGN(p.invoicePriceCents)}</td>
                  <td className="num">{formatMoneyBGN(p.salePriceCents)}</td>
                  <td>
                    <span className={`badge ${p.isActive ? "badge-success" : "badge-muted"}`}>
                      {p.isActive ? "Активен" : "Неактивен"}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm" onClick={() => setModal(p)}>
                        Редактирай
                      </button>
                      <button className="btn btn-sm" onClick={() => toggleActive(p)}>
                        {p.isActive ? "Деактивирай" : "Активирай"}
                      </button>
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => setToDelete(p)}>
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
        <Modal title="Нов продукт" onClose={() => setModal(null)}>
          <ProductForm onSubmit={handleCreate} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== "create" && (
        <Modal title="Редактирай продукт" onClose={() => setModal(null)}>
          <ProductForm initial={modal} onSubmit={(input) => handleUpdate(modal.id, input)} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Изтриване на продукт"
          message={`Сигурни ли сте, че искате да изтриете продукт „${toDelete.name}“?`}
          confirmLabel="Изтрий"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
