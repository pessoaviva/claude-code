import dotenv from "dotenv";
dotenv.config();

/**
 * Quote providers are tried in the order listed (fallback architecture).
 * Providers without a required API key are automatically skipped.
 */
export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://fintrack:fintrack@localhost:5432/fintrack",
  port: Number(process.env.PORT ?? 4000),
  quote: {
    // Legacy single-URL knobs (kept for backward compatibility).
    url: process.env.QUOTE_PROVIDER_URL ?? "https://brapi.dev/api/quote",
    token: process.env.QUOTE_PROVIDER_TOKEN ?? "",
    timeoutMs: Number(process.env.QUOTE_TIMEOUT_MS ?? 4000),
  },
  providers: {
    brapi: {
      url: process.env.BRAPI_URL ?? "https://brapi.dev/api/quote",
      token: process.env.BRAPI_TOKEN ?? process.env.QUOTE_PROVIDER_TOKEN ?? "",
    },
    yahoo: {
      url: process.env.YAHOO_URL ?? "https://query1.finance.yahoo.com/v8/finance/chart",
    },
    alphavantage: {
      url: process.env.ALPHAVANTAGE_URL ?? "https://www.alphavantage.co/query",
      key: process.env.ALPHAVANTAGE_KEY ?? "",
    },
    finnhub: {
      url: process.env.FINNHUB_URL ?? "https://finnhub.io/api/v1/quote",
      key: process.env.FINNHUB_KEY ?? "",
    },
  },
  // Reliability A/B/C thresholds (minutes).
  reliability: {
    freshMinutes: Number(process.env.RELIABILITY_FRESH_MIN ?? 15),
    staleMinutes: Number(process.env.RELIABILITY_STALE_MIN ?? 60),
  },
};
