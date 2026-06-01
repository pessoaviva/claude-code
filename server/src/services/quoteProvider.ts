import { config } from "../config.js";
import { audit } from "../lib/audit.js";

export interface FetchedQuote {
  ticker: string;
  price: string; // canonical decimal string
}

export class QuoteProviderError extends Error {
  constructor(message: string, public cause?: unknown) {
    super(message);
    this.name = "QuoteProviderError";
  }
}

/**
 * Fetch a quote from the external provider (AUTO mode).
 *
 * Designed to fail gracefully: any network/timeout/parse error throws a
 * QuoteProviderError which callers catch to fall back to MANUAL entry. The
 * system never depends on this succeeding.
 */
export async function fetchQuoteAuto(ticker: string): Promise<FetchedQuote> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.quote.timeoutMs);
  const url = `${config.quote.url}/${encodeURIComponent(ticker)}${
    config.quote.token ? `?token=${encodeURIComponent(config.quote.token)}` : ""
  }`;

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new QuoteProviderError(`Provedor respondeu HTTP ${res.status}`);
    }
    const json: any = await res.json();
    // brapi.dev shape: { results: [{ symbol, regularMarketPrice }] }
    const result = json?.results?.[0];
    const price = result?.regularMarketPrice ?? json?.price ?? json?.regularMarketPrice;
    if (price == null || Number.isNaN(Number(price))) {
      throw new QuoteProviderError("Resposta do provedor sem preço válido");
    }
    await audit({
      category: "integration",
      entity: "quote",
      entityId: ticker,
      action: "fetch_auto_success",
      details: { url, price },
    });
    return { ticker, price: String(price) };
  } catch (err) {
    const message =
      err instanceof QuoteProviderError
        ? err.message
        : (err as Error)?.name === "AbortError"
        ? `Timeout após ${config.quote.timeoutMs}ms`
        : `Falha de rede: ${(err as Error)?.message ?? "desconhecida"}`;
    await audit({
      category: "error",
      entity: "quote",
      entityId: ticker,
      action: "fetch_auto_failed",
      details: { url, message },
    });
    throw new QuoteProviderError(message, err);
  } finally {
    clearTimeout(timer);
  }
}
