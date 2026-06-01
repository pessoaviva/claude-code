import { config } from "../config.js";

/** Result of a single provider fetch attempt (recorded for diagnostics/score). */
export interface ProviderAttempt {
  provider: string;
  url: string;
  ok: boolean;
  httpStatus: number | null;
  responseMs: number;
  price: string | null;
  error: string | null;
  rawExcerpt: string;
}

interface ProviderDef {
  name: string;
  /** Whether the provider is usable (e.g. has a required API key). */
  enabled: () => boolean;
  /** Reason shown in diagnostics when disabled. */
  disabledReason: string;
  url: (ticker: string) => string;
  headers?: () => Record<string, string>;
  /** Extract a numeric price from the parsed JSON, or null if absent. */
  parse: (json: any) => number | null;
}

/** Yahoo/AlphaVantage expect a suffix for B3 tickers (e.g. PETR4 -> PETR4.SA). */
function withSaSuffix(ticker: string): string {
  return /^[A-Z]{4}\d{1,2}$/.test(ticker) ? `${ticker}.SA` : ticker;
}

/** Provider order defines the fallback chain. */
export const PROVIDERS: ProviderDef[] = [
  {
    name: "brapi",
    enabled: () => true,
    disabledReason: "",
    url: (t) =>
      `${config.providers.brapi.url}/${encodeURIComponent(t)}` +
      (config.providers.brapi.token ? `?token=${encodeURIComponent(config.providers.brapi.token)}` : ""),
    parse: (json) => json?.results?.[0]?.regularMarketPrice ?? null,
  },
  {
    name: "yahoo",
    enabled: () => true,
    disabledReason: "",
    url: (t) => `${config.providers.yahoo.url}/${encodeURIComponent(withSaSuffix(t))}`,
    parse: (json) => json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null,
  },
  {
    name: "alphavantage",
    enabled: () => Boolean(config.providers.alphavantage.key),
    disabledReason: "ALPHAVANTAGE_KEY não configurada",
    url: (t) =>
      `${config.providers.alphavantage.url}?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(
        withSaSuffix(t)
      )}&apikey=${encodeURIComponent(config.providers.alphavantage.key)}`,
    parse: (json) => {
      const p = json?.["Global Quote"]?.["05. price"];
      return p != null ? Number(p) : null;
    },
  },
  {
    name: "finnhub",
    enabled: () => Boolean(config.providers.finnhub.key),
    disabledReason: "FINNHUB_KEY não configurada",
    url: (t) =>
      `${config.providers.finnhub.url}?symbol=${encodeURIComponent(t)}&token=${encodeURIComponent(
        config.providers.finnhub.key
      )}`,
    // finnhub: c = current price; 0 means "no data".
    parse: (json) => (json?.c ? Number(json.c) : null),
  },
];

export function listProviders(): { name: string; enabled: boolean; disabledReason: string }[] {
  return PROVIDERS.map((p) => ({ name: p.name, enabled: p.enabled(), disabledReason: p.disabledReason }));
}

/** Fetch a single provider, always returning a recorded attempt (never throws). */
async function tryProvider(def: ProviderDef, ticker: string): Promise<ProviderAttempt> {
  const url = def.url(ticker);
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.quote.timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "FinTrackPro/1.0", ...(def.headers?.() ?? {}) },
    });
    const responseMs = Date.now() - start;
    const text = await res.text();
    const rawExcerpt = text.slice(0, 500);
    if (!res.ok) {
      return { provider: def.name, url, ok: false, httpStatus: res.status, responseMs, price: null, error: `HTTP ${res.status}`, rawExcerpt };
    }
    let json: any;
    try {
      json = JSON.parse(text);
    } catch {
      return { provider: def.name, url, ok: false, httpStatus: res.status, responseMs, price: null, error: "Resposta não-JSON", rawExcerpt };
    }
    const price = def.parse(json);
    if (price == null || Number.isNaN(Number(price)) || Number(price) <= 0) {
      return { provider: def.name, url, ok: false, httpStatus: res.status, responseMs, price: null, error: "Sem preço válido na resposta", rawExcerpt };
    }
    return { provider: def.name, url, ok: true, httpStatus: res.status, responseMs, price: String(price), error: null, rawExcerpt };
  } catch (err) {
    const responseMs = Date.now() - start;
    const error =
      (err as Error)?.name === "AbortError"
        ? `Timeout após ${config.quote.timeoutMs}ms`
        : `Falha de rede: ${(err as Error)?.message ?? "desconhecida"}`;
    return { provider: def.name, url, ok: false, httpStatus: null, responseMs, price: null, error, rawExcerpt: "" };
  } finally {
    clearTimeout(timer);
  }
}

export interface FallbackResult {
  success: boolean;
  price: string | null;
  provider: string | null;
  attempts: ProviderAttempt[];
}

/**
 * Try each enabled provider in order. Stop at the first valid price.
 * Disabled providers are recorded as skipped attempts so diagnostics show why.
 */
export async function fetchWithFallback(ticker: string): Promise<FallbackResult> {
  const attempts: ProviderAttempt[] = [];
  for (const def of PROVIDERS) {
    if (!def.enabled()) {
      attempts.push({
        provider: def.name, url: def.url(ticker), ok: false, httpStatus: null,
        responseMs: 0, price: null, error: `Ignorado: ${def.disabledReason}`, rawExcerpt: "",
      });
      continue;
    }
    const attempt = await tryProvider(def, ticker);
    attempts.push(attempt);
    if (attempt.ok) {
      return { success: true, price: attempt.price, provider: def.name, attempts };
    }
  }
  return { success: false, price: null, provider: null, attempts };
}
