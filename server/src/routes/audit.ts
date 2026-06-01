import { Router } from "express";
import { query, pool } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/http.js";
import { config } from "../config.js";

export const auditRouter = Router();

// Logs tab — filter by category, paginated.
auditRouter.get(
  "/logs",
  asyncHandler(async (req, res) => {
    const category = typeof req.query.category === "string" ? req.query.category : null;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const params: unknown[] = [];
    let where = "";
    if (category && category !== "all") {
      params.push(category);
      where = `WHERE category = $1`;
    }
    const { rows } = await query(
      `SELECT * FROM audit_log ${where} ORDER BY ts DESC LIMIT ${limit}`,
      params
    );
    ok(res, rows);
  })
);

// Diagnóstico tab — health of DB, quote integration and error counts.
auditRouter.get(
  "/diagnostics",
  asyncHandler(async (_req, res) => {
    let dbOk = false;
    let dbLatencyMs: number | null = null;
    try {
      const start = Date.now();
      await pool.query("SELECT 1");
      dbLatencyMs = Date.now() - start;
      dbOk = true;
    } catch {
      dbOk = false;
    }

    const errorCount = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM audit_log WHERE category='error' AND ts > now() - interval '24 hours'`
    );
    const lastError = await query(
      `SELECT * FROM audit_log WHERE category='error' ORDER BY ts DESC LIMIT 1`
    );
    const lastQuote = await query(
      `SELECT * FROM audit_log WHERE category IN ('quote','integration','manual') ORDER BY ts DESC LIMIT 1`
    );
    const counts = await query<{ category: string; count: string }>(
      `SELECT category, COUNT(*) AS count FROM audit_log GROUP BY category`
    );

    ok(res, {
      database: { ok: dbOk, latencyMs: dbLatencyMs },
      quoteProvider: {
        url: config.quote.url,
        tokenConfigured: Boolean(config.quote.token),
        timeoutMs: config.quote.timeoutMs,
      },
      errors24h: Number(errorCount.rows[0].count),
      lastError: lastError.rows[0] ?? null,
      lastQuoteActivity: lastQuote.rows[0] ?? null,
      auditCounts: counts.rows,
      uptimeSec: Math.round(process.uptime()),
    });
  })
);
