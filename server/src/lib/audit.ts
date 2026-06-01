import type { PoolClient } from "pg";
import { query } from "../db/pool.js";

export type AuditCategory = "change" | "quote" | "error" | "integration" | "manual";

export interface AuditEntry {
  category: AuditCategory;
  entity: string;
  entityId?: string | number | null;
  action: string;
  actor?: string;
  details?: Record<string, unknown>;
  before?: unknown;
  after?: unknown;
}

/**
 * Append an immutable audit record. Auditing must never throw in a way that
 * masks the underlying operation, but we also must never silently swallow the
 * fact that an audit write failed — so failures are logged loudly to stderr.
 */
export async function audit(entry: AuditEntry, client?: PoolClient): Promise<void> {
  const sql = `
    INSERT INTO audit_log (category, entity, entity_id, action, actor, details, before_data, after_data)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;
  const params = [
    entry.category,
    entry.entity,
    entry.entityId != null ? String(entry.entityId) : null,
    entry.action,
    entry.actor ?? "system",
    JSON.stringify(entry.details ?? {}),
    entry.before != null ? JSON.stringify(entry.before) : null,
    entry.after != null ? JSON.stringify(entry.after) : null,
  ];
  try {
    if (client) await client.query(sql, params);
    else await query(sql, params);
  } catch (err) {
    console.error("[audit] FAILED to write audit record:", err, entry);
  }
}
