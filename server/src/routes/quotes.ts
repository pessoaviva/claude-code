import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, reqString } from "../lib/http.js";
import { Decimal } from "../lib/decimal.js";
import { fetchQuoteAuto, QuoteProviderError } from "../services/quoteProvider.js";
import { computePortfolio } from "../services/portfolio.js";

export const quotesRouter = Router();

async function saveQuote(ticker: string, price: Decimal, source: "auto" | "manual", provider: string | null = null) {
  const { rows } = await query(
    `INSERT INTO quotes (ticker, price, source, provider) VALUES ($1,$2,$3,$4) RETURNING *`,
    [ticker, price.toFixed(8), source, provider]
  );
  return rows[0];
}

// Latest quote per ticker + recent history.
quotesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`
      SELECT DISTINCT ON (ticker) ticker, price, source, provider, fetched_at
      FROM quotes ORDER BY ticker, fetched_at DESC
    `);
    ok(res, rows);
  })
);

/**
 * AUTO mode: try the external provider. On failure we DO NOT fabricate a price —
 * we return 502 with a clear message so the UI prompts for MANUAL entry.
 */
quotesRouter.post(
  "/auto/:ticker",
  asyncHandler(async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    try {
      const fetched = await fetchQuoteAuto(ticker);
      const row = await saveQuote(ticker, Decimal.from(fetched.price), "auto", fetched.provider);
      await audit({ category: "quote", entity: "quote", entityId: ticker, action: "update_auto", details: { provider: fetched.provider }, after: row });
      ok(res, { quote: row, provider: fetched.provider, portfolio: await computePortfolio() });
    } catch (err) {
      if (err instanceof QuoteProviderError) {
        throw new AppError(
          502,
          `Cotação automática indisponível para ${ticker}: ${err.message}. Use o modo manual.`,
          { ticker, mode: "manual_required", attempts: err.attempts }
        );
      }
      throw err;
    }
  })
);

/**
 * MANUAL mode: always available. Records price + timestamp + source=manual and
 * recalculates the whole portfolio so the user sees the effect immediately.
 */
quotesRouter.post(
  "/manual",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const ticker = reqString(body, "ticker").toUpperCase();
    const price = Decimal.from(body.price ?? "");
    if (price.isNegative()) throw new AppError(400, "price não pode ser negativo");

    const row = await saveQuote(ticker, price, "manual");
    await audit({
      category: "manual",
      entity: "quote",
      entityId: ticker,
      action: "update_manual",
      details: { price: row.price, fetched_at: row.fetched_at },
      after: row,
    });
    ok(res, { quote: row, portfolio: await computePortfolio() });
  })
);
