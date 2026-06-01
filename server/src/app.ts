import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { incomeRouter } from "./routes/income.js";
import { expensesRouter } from "./routes/expenses.js";
import { stocksRouter } from "./routes/stocks.js";
import { quotesRouter } from "./routes/quotes.js";
import { networthRouter } from "./routes/networth.js";
import { salesRouter } from "./routes/sales.js";
import { goalsRouter } from "./routes/goals.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { auditRouter } from "./routes/audit.js";
import { diagnosticsRouter } from "./routes/diagnostics.js";
import { errorHandler } from "./middleware/errorHandler.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => res.json({ ok: true, service: "fintrack-pro", time: new Date().toISOString() }));

  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/income", incomeRouter);
  app.use("/api/expenses", expensesRouter);
  app.use("/api/stocks", stocksRouter);
  app.use("/api/quotes", quotesRouter);
  app.use("/api/networth", networthRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/audit", auditRouter);
  app.use("/api/diagnostics", diagnosticsRouter);

  // Serve the built React app from the SAME server when it's present (single
  // service on Render/Railway/VPS). Skipped on Netlify, where the function only
  // handles /api and Netlify serves the static site separately.
  //
  // Path resolution is defensive: `import.meta.url` is valid in the ESM build
  // but becomes undefined when this module is bundled to CJS (Netlify esbuild),
  // so we fall back to process.cwd() and never throw.
  const webDist = resolveWebDist();
  if (webDist) {
    app.use(express.static(webDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(join(webDist, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}

function resolveWebDist(): string | null {
  try {
    const metaUrl = (import.meta as { url?: string } | undefined)?.url;
    const base = metaUrl ? dirname(fileURLToPath(metaUrl)) : process.cwd();
    for (const candidate of [join(base, "../../web/dist"), join(process.cwd(), "web/dist")]) {
      if (existsSync(candidate)) return candidate;
    }
  } catch {
    /* no static dir available (e.g. serverless function) — serve API only */
  }
  return null;
}
