import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/http.js";
import { listProviders } from "../services/providers.js";
import { computePortfolio } from "../services/portfolio.js";

export const diagnosticsRouter = Router();

const ONLINE_WINDOW = "interval '60 minutes'";

/**
 * Painel geral de Diagnóstico + Dashboard de Saúde.
 * - Provedores: status, contagem de sucesso/erro, tempo médio, última sincronização.
 * - Saúde: contagem de ativos A/B/C, APIs online/offline, última atualização.
 */
diagnosticsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const stats = await query<{
      provider: string; successes: string; failures: string;
      avg_ms: string | null; last_at: string | null; last_success_at: string | null;
    }>(`
      SELECT provider,
        COUNT(*) FILTER (WHERE ok)        AS successes,
        COUNT(*) FILTER (WHERE NOT ok)    AS failures,
        ROUND(AVG(response_ms) FILTER (WHERE ok))::int AS avg_ms,
        MAX(created_at)                   AS last_at,
        MAX(created_at) FILTER (WHERE ok) AS last_success_at
      FROM quote_attempts GROUP BY provider
    `);
    const statMap = new Map(stats.rows.map((s) => [s.provider, s]));

    const onlineRow = await query<{ provider: string }>(`
      SELECT DISTINCT provider FROM quote_attempts
      WHERE ok AND created_at > now() - ${ONLINE_WINDOW}
    `);
    const onlineSet = new Set(onlineRow.rows.map((r) => r.provider));

    const providers = listProviders().map((p) => {
      const s = statMap.get(p.name);
      return {
        name: p.name,
        configured: p.enabled,
        disabledReason: p.disabledReason,
        online: onlineSet.has(p.name),
        successes: Number(s?.successes ?? 0),
        failures: Number(s?.failures ?? 0),
        avgResponseMs: s?.avg_ms != null ? Number(s.avg_ms) : null,
        lastAt: s?.last_at ?? null,
        lastSuccessAt: s?.last_success_at ?? null,
      };
    });

    const overall = await query<{ last_sync: string | null; avg_ms: string | null }>(`
      SELECT MAX(created_at) AS last_sync,
             ROUND(AVG(response_ms) FILTER (WHERE ok))::int AS avg_ms
      FROM quote_attempts
    `);

    const portfolio = await computePortfolio();

    ok(res, {
      providers,
      health: {
        assetsA: portfolio.totals.countA,
        assetsB: portfolio.totals.countB,
        assetsC: portfolio.totals.countC,
        apisOnline: providers.filter((p) => p.online).length,
        apisOffline: providers.filter((p) => p.configured && !p.online).length,
        apisDisabled: providers.filter((p) => !p.configured).length,
        lastSync: overall.rows[0].last_sync,
        avgResponseMs: overall.rows[0].avg_ms != null ? Number(overall.rows[0].avg_ms) : null,
      },
    });
  })
);

/** Diagnóstico por ativo: ticker, fonte, URL, última resposta, data/hora, tempo, status, último erro. */
diagnosticsRouter.get(
  "/assets",
  asyncHandler(async (_req, res) => {
    const portfolio = await computePortfolio();

    const lastAttempt = await query<{
      ticker: string; provider: string; url: string; ok: boolean;
      http_status: number | null; response_ms: number | null; raw_excerpt: string | null; created_at: string;
    }>(`
      SELECT DISTINCT ON (ticker) ticker, provider, url, ok, http_status, response_ms, raw_excerpt, created_at
      FROM quote_attempts ORDER BY ticker, created_at DESC
    `);
    const attemptMap = new Map(lastAttempt.rows.map((a) => [a.ticker.toUpperCase(), a]));

    const lastError = await query<{ ticker: string; error: string | null; created_at: string }>(`
      SELECT DISTINCT ON (ticker) ticker, error, created_at
      FROM quote_attempts WHERE NOT ok ORDER BY ticker, created_at DESC
    `);
    const errorMap = new Map(lastError.rows.map((e) => [e.ticker.toUpperCase(), e]));

    const assets = portfolio.positions.map((p) => {
      const a = attemptMap.get(p.ticker.toUpperCase());
      const e = errorMap.get(p.ticker.toUpperCase());
      return {
        ticker: p.ticker,
        source: p.quoteSource,
        provider: a?.provider ?? p.quoteProvider ?? null,
        url: a?.url ?? null,
        lastResponse: a?.raw_excerpt ?? null,
        at: a?.created_at ?? p.quoteAt ?? null,
        responseMs: a?.response_ms ?? null,
        status: a ? (a.ok ? "ok" : `erro (${a.http_status ?? "rede"})`) : "sem tentativa automática",
        lastError: e ? { message: e.error, at: e.created_at } : null,
        level: p.reliability.level,
        levelLabel: p.reliability.label,
        score: p.score.score,
        scoreBreakdown: p.score,
      };
    });
    ok(res, assets);
  })
);
