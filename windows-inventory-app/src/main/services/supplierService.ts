import { getDb, nowIso } from "../db/database";
import { Errors } from "../errors";
import { logAudit } from "./auditService";
import type { Supplier } from "../../shared/types";

export function listSuppliers(search?: string): Supplier[] {
  const db = getDb();
  if (search && search.trim()) {
    return db
      .prepare("SELECT id, name, created_at as createdAt FROM suppliers WHERE bg_lower(name) LIKE bg_lower(?) ORDER BY bg_lower(name)")
      .all(`%${search.trim()}%`) as Supplier[];
  }
  return db.prepare("SELECT id, name, created_at as createdAt FROM suppliers ORDER BY bg_lower(name)").all() as Supplier[];
}

export function getOrCreateSupplierByName(name: string): Supplier {
  const trimmed = name.trim();
  if (!trimmed) throw Errors.validation("Името на доставчика е задължително.");
  const db = getDb();
  const existing = db
    .prepare("SELECT id, name, created_at as createdAt FROM suppliers WHERE bg_lower(name) = bg_lower(?)")
    .get(trimmed) as Supplier | undefined;
  if (existing) return existing;
  const result = db
    .prepare("INSERT INTO suppliers (name, created_at) VALUES (?, ?)")
    .run(trimmed, nowIso());
  logAudit("supplier", Number(result.lastInsertRowid), "created", `Добавен доставчик „${trimmed}“`);
  return { id: Number(result.lastInsertRowid), name: trimmed, createdAt: nowIso() };
}

export function getSupplier(id: number): Supplier {
  const row = getDb()
    .prepare("SELECT id, name, created_at as createdAt FROM suppliers WHERE id = ?")
    .get(id) as Supplier | undefined;
  if (!row) throw Errors.notFound("Доставчикът");
  return row;
}
