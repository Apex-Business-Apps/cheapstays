import { getDb, nowIso } from "../db/database";
import type { AuditLogEntry } from "../../shared/types";

export function logAudit(
  entityType: string,
  entityId: number | null,
  action: string,
  description: string,
  details?: unknown
): void {
  getDb()
    .prepare(
      `INSERT INTO audit_log (entity_type, entity_id, action, description, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      entityType,
      entityId,
      action,
      description,
      details !== undefined ? JSON.stringify(details) : null,
      nowIso()
    );
}

export function listAuditLog(limit = 200): AuditLogEntry[] {
  const rows = getDb()
    .prepare(
      `SELECT id, entity_type as entityType, entity_id as entityId, action, description, created_at as createdAt
       FROM audit_log ORDER BY id DESC LIMIT ?`
    )
    .all(limit) as AuditLogEntry[];
  return rows;
}

export function searchAuditLog(query: string, limit = 200): AuditLogEntry[] {
  const like = `%${query}%`;
  const rows = getDb()
    .prepare(
      `SELECT id, entity_type as entityType, entity_id as entityId, action, description, created_at as createdAt
       FROM audit_log WHERE bg_lower(description) LIKE bg_lower(?) ORDER BY id DESC LIMIT ?`
    )
    .all(like, limit) as AuditLogEntry[];
  return rows;
}
