import { query } from "../db/pool.js";
import { audit } from "../lib/audit.js";
import { fetchWithFallback, type ProviderAttempt } from "./providers.js";

export interface FetchedQuote {
  ticker: string;
  price: string; // canonical decimal string
  provider: string; // provider that supplied the price
}

export class QuoteProviderError extends Error {
  constructor(message: string, public attempts: ProviderAttempt[] = []) {
    super(message);
    this.name = "QuoteProviderError";
  }
}

/** Persist every real provider attempt so diagnostics and scores are auditable.
 *  Skipped providers (missing API key) are not recorded — they never ran. */
async function recordAttempts(ticker: string, attempts: ProviderAttempt[]): Promise<void> {
  for (const a of attempts) {
    if (a.error?.startsWith("Ignorado")) continue;
    await query(
      `INSERT INTO quote_attempts (ticker, provider, url, ok, http_status, response_ms, price, error, raw_excerpt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [ticker, a.provider, a.url, a.ok, a.httpStatus, a.responseMs, a.price, a.error, a.rawExcerpt]
    );
    await audit({
      category: a.ok ? "integration" : "error",
      entity: "quote",
      entityId: ticker,
      action: a.ok ? "fetch_provider_success" : "fetch_provider_failed",
      details: { provider: a.provider, url: a.url, httpStatus: a.httpStatus, responseMs: a.responseMs, error: a.error, price: a.price },
    });
  }
}

/**
 * AUTO mode with multi-provider fallback (Brapi → Yahoo → Alpha Vantage → Finnhub).
 *
 * Tries each provider in order; records all attempts. On total failure throws a
 * QuoteProviderError so callers fall back to MANUAL entry. Never fabricates a price.
 */
export async function fetchQuoteAuto(ticker: string): Promise<FetchedQuote> {
  const result = await fetchWithFallback(ticker);
  await recordAttempts(ticker, result.attempts);

  if (!result.success || result.price == null || result.provider == null) {
    const reasons = result.attempts.map((a) => `${a.provider}: ${a.error ?? "?"}`).join(" | ");
    throw new QuoteProviderError(
      `Nenhum provedor retornou cotação válida (${reasons})`,
      result.attempts
    );
  }
  return { ticker, price: result.price, provider: result.provider };
}
