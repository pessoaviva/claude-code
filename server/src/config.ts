import dotenv from "dotenv";
dotenv.config();

export const config = {
  databaseUrl:
    process.env.DATABASE_URL ??
    "postgresql://fintrack:fintrack@localhost:5432/fintrack",
  port: Number(process.env.PORT ?? 4000),
  quote: {
    url: process.env.QUOTE_PROVIDER_URL ?? "https://brapi.dev/api/quote",
    token: process.env.QUOTE_PROVIDER_TOKEN ?? "",
    timeoutMs: Number(process.env.QUOTE_TIMEOUT_MS ?? 4000),
  },
};
