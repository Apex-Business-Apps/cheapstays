import React, { useEffect, useMemo, useState } from "react";
import { api, errorMessage } from "../lib/api";
import { useToast } from "../components/Toast";
import { Modal, ConfirmDialog } from "../components/Modal";
import { ProductPicker } from "../components/ProductPicker";
import { formatMoneyBGN, formatQuantity } from "../../shared/money";
import { monthOptions, currentYear } from "../lib/dateHelpers";
import type { Invoice, InvoiceInput, InvoiceItemInput, Product, Supplier } from "../../shared/types";

interface DraftLine extends InvoiceItemInput {
  key: number;
}

let lineKeyCounter = 0;

function newLine(): DraftLine {
  return { key: ++lineKeyCounter, productId: 0, quantity: 0, invoicePriceCents: 0, salePriceCents: 0 };
}

function InvoiceForm({
  products,
  suppliers,
  initial,
  onSubmit,
  onCancel,
}: {
  products: Product[];
  suppliers: Supplier[];
  initial?: Invoice;
  onSubmit: (input: InvoiceInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoiceNumber ?? "");
  const [supplierName, setSupplierName] = useState(initial?.supplierName ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoiceDate ?? new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(initial?.note ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    initial
      ? initial.items.map((it) => ({
          key: ++lineKeyCounter,
          productId: it.productId,
          quantity: it.quantityMilli / 1000,
          invoicePriceCents: it.invoicePriceCents,
          salePriceCents: it.salePriceCents,
        }))
      : [newLine()]
  );
  const [saving, setSaving] = useState(false);
  const { show } = useToast();

  function updateLine(key: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function handleProductChange(key: number, productId: number | null) {
    const product = products.find((p) => p.id === productId);
    updateLine(key, {
      productId: productId ?? 0,
      invoicePriceCents: product ? product.invoicePriceCents : 0,
      salePriceCents: product ? product.salePriceCents : 0,
    });
  }

  const totals = useMemo(() => {
    let purchase = 0;
    let sale = 0;
    for (const l of lines) {
      purchase += Math.round((l.quantity * 1000 * l.invoicePriceCents) / 1000);
      sale += Math.round((l.quantity * 1000 * l.salePriceCents) / 1000);
    }
    return { purchase, sale };
  }, [lines]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validLines = lines.filter((l) => l.productId > 0 && l.quantity > 0);
    if (validLines.length === 0) {
      show("Добавете поне един продукт с количество.", "error");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        invoiceNumber,
        supplierId: null,
        supplierName,
        invoiceDate,
        note,
        items: validLines.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          invoicePriceCents: l.invoicePriceCents,
          salePriceCents: l.salePriceCents,
        })),
      });
    } catch (err) {
      show(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field-row">
        <div className="field">
          <label>Номер на фактура</label>
          <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
        </div>
        <div className="field">
          <label>Доставчик</label>
          <input
            type="text"
            list="suppliers-list"
            value={supplierName}
            onChange={(e) => setSupplierName(e.target.value)}
            required
          />
          <datalist id="suppliers-list">
            {suppliers.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
        </div>
        <div className="field">
          <label>Дата</label>
          <input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
        </div>
      </div>

      <label>Продукти по фактурата</label>
      {lines.map((line) => {
        const product = products.find((p) => p.id === line.productId);
        return (
          <div className="invoice-line-row" key={line.key}>
            <div>
              <ProductPicker products={products} value={line.productId || null} onChange={(id) => handleProductChange(line.key, id)} />
            </div>
            <div>
              <input
                type="number"
                min="0"
                step="0.001"
                placeholder={product ? (product.unit === "kg" ? "кг." : "бр.") : "Количество"}
                value={line.quantity || ""}
                onChange={(e) => updateLine(line.key, { quantity: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Цена по фактура"
                value={line.invoicePriceCents ? (line.invoicePriceCents / 100).toFixed(2) : ""}
                onChange={(e) => updateLine(line.key, { invoicePriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
              />
            </div>
            <div>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Изходна цена"
                value={line.salePriceCents ? (line.salePriceCents / 100).toFixed(2) : ""}
                onChange={(e) => updateLine(line.key, { salePriceCents: Math.round((parseFloat(e.target.value) || 0) * 100) })}
              />
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost text-danger"
              onClick={() => setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== line.key) : prev))}
            >
              ✕
            </button>
          </div>
        );
      })}
      <button type="button" className="btn btn-sm" onClick={() => setLines((prev) => [...prev, newLine()])}>
        + Добави продукт
      </button>

      <div className="field" style={{ marginTop: 14 }}>
        <label>Бележка (по избор)</label>
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>

      <div className="card" style={{ background: "var(--surface-muted)", marginTop: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600 }}>
          <span>Общо по покупна цена:</span>
          <span>{formatMoneyBGN(totals.purchase)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginTop: 4 }}>
          <span>Общо по изходна цена:</span>
          <span>{formatMoneyBGN(totals.sale)}</span>
        </div>
      </div>

      <div className="modal-actions">
        <button type="button" className="btn" onClick={onCancel}>
          Отказ
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Запазване…" : "Запази фактурата"}
        </button>
      </div>
    </form>
  );
}

export default function Receiving() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [year, setYear] = useState<number | "">(currentYear());
  const [month, setMonth] = useState<number | "">("");
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"create" | Invoice | null>(null);
  const [toDelete, setToDelete] = useState<Invoice | null>(null);
  const { show } = useToast();

  async function load() {
    try {
      const [inv, prod, sup] = await Promise.all([
        api.invoices.list({ year: year || undefined, month: month || undefined, search: search || undefined }),
        api.products.list({}),
        api.suppliers.list(),
      ]);
      setInvoices(inv);
      setProducts(prod);
      setSuppliers(sup);
    } catch (err) {
      show(errorMessage(err), "error");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, search]);

  async function handleCreate(input: InvoiceInput) {
    const inv = await api.invoices.create(input);
    show(`Фактура № ${inv.invoiceNumber} е добавена.`, "success");
    setModal(null);
    load();
  }

  async function handleUpdate(id: number, input: InvoiceInput) {
    const inv = await api.invoices.update(id, input);
    show(`Фактура № ${inv.invoiceNumber} е обновена.`, "success");
    setModal(null);
    load();
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api.invoices.delete(toDelete.id);
      show(`Фактура № ${toDelete.invoiceNumber} е изтрита.`, "success");
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
          <input type="text" placeholder="Търсене по № или доставчик…" value={search} onChange={(e) => setSearch(e.target.value)} />
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
          + Нова фактура
        </button>
      </div>

      <div className="table-wrap">
        {invoices.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🧾</div>
            Няма намерени фактури.
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>№ Фактура</th>
                <th>Доставчик</th>
                <th>Дата</th>
                <th className="num">Продукти</th>
                <th className="num">По покупна цена</th>
                <th className="num">По изходна цена</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNumber}</td>
                  <td>{inv.supplierName}</td>
                  <td>{inv.invoiceDate}</td>
                  <td className="num">{inv.items.length}</td>
                  <td className="num">{formatMoneyBGN(inv.totals.totalPurchaseCents)}</td>
                  <td className="num">{formatMoneyBGN(inv.totals.totalSaleCents)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button className="btn btn-sm" onClick={() => setModal(inv)}>
                        Редактирай
                      </button>
                      <button className="btn btn-sm btn-ghost text-danger" onClick={() => setToDelete(inv)}>
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
        <Modal title="Нова фактура" onClose={() => setModal(null)} wide>
          <InvoiceForm products={products} suppliers={suppliers} onSubmit={handleCreate} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== "create" && (
        <Modal title={`Редактирай фактура № ${modal.invoiceNumber}`} onClose={() => setModal(null)} wide>
          <InvoiceForm
            products={products}
            suppliers={suppliers}
            initial={modal}
            onSubmit={(input) => handleUpdate(modal.id, input)}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}
      {toDelete && (
        <ConfirmDialog
          title="Изтриване на фактура"
          message={`Сигурни ли сте, че искате да изтриете фактура № ${toDelete.invoiceNumber}?`}
          confirmLabel="Изтрий"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
