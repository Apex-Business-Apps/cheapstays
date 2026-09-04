-- Inventory Manager — initial schema
-- All money in integer stotinki (лв. * 100). All quantities in integer
-- milli-units (unit * 1000). Balances are NEVER stored as a single mutable
-- field — they are always derived from the stock_movements ledger so that
-- editing a historical movement automatically keeps every later period correct.

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'pcs')),
  invoice_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (invoice_price_cents >= 0),
  sale_price_cents INTEGER NOT NULL DEFAULT 0 CHECK (sale_price_cents >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_name_ci ON products (bg_lower(name));
CREATE INDEX IF NOT EXISTS idx_products_active ON products (is_active);

CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_name_ci ON suppliers (bg_lower(name));

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT NOT NULL,
  supplier_id INTEGER NOT NULL REFERENCES suppliers (id),
  invoice_date TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_number_supplier ON invoices (bg_lower(invoice_number), supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices (period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices (invoice_date);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id),
  unit TEXT NOT NULL CHECK (unit IN ('kg', 'pcs')),
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  invoice_price_cents INTEGER NOT NULL CHECK (invoice_price_cents >= 0),
  sale_price_cents INTEGER NOT NULL CHECK (sale_price_cents >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items (product_id);

CREATE TABLE IF NOT EXISTS stock_outs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id),
  movement_date TEXT NOT NULL,
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'waste', 'return', 'other')),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_outs_product ON stock_outs (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_outs_date ON stock_outs (movement_date);

-- The ledger. Every receiving line and every stock-out creates exactly one
-- row here (kept in sync transactionally by the service layer, including on
-- edit/delete). Current & historical balances are always SUM()'d from this
-- table — never cached in a way that could drift.
CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products (id),
  movement_date TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  quantity_milli INTEGER NOT NULL CHECK (quantity_milli > 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('invoice_item', 'stock_out', 'adjustment')),
  source_id INTEGER,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_movements_product_date ON stock_movements (product_id, movement_date, id);
CREATE INDEX IF NOT EXISTS idx_movements_source ON stock_movements (source_type, source_id);

CREATE TABLE IF NOT EXISTS periods (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  closed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_periods_year_month ON periods (year, month);

-- Informational snapshot written when a month is closed. Purely a fast,
-- auditable record of what the numbers were at close time — the live report
-- screens always recompute from stock_movements so an edit to a closed
-- month is still reflected correctly (see periodService.reopenIfStale).
CREATE TABLE IF NOT EXISTS period_closing_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES periods (id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products (id),
  opening_qty_milli INTEGER NOT NULL,
  received_qty_milli INTEGER NOT NULL,
  issued_qty_milli INTEGER NOT NULL,
  closing_qty_milli INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_period_product ON period_closing_snapshots (period_id, product_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  action TEXT NOT NULL,
  description TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log (created_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  file_size_bytes INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('manual', 'scheduled', 'pre_restore')),
  created_at TEXT NOT NULL
);
