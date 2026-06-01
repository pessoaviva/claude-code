import express from "express";
import cors from "cors";
import { incomeRouter } from "./routes/income.js";
import { expensesRouter } from "./routes/expenses.js";
import { stocksRouter } from "./routes/stocks.js";
import { quotesRouter } from "./routes/quotes.js";
import { networthRouter } from "./routes/networth.js";
import { salesRouter } from "./routes/sales.js";
import { goalsRouter } from "./routes/goals.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { auditRouter } from "./routes/audit.js";
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

  app.use(errorHandler);
  return app;
}
