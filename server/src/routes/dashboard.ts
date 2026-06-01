import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { ok } from "../lib/http.js";
import { Decimal } from "../lib/decimal.js";
import { computePortfolio } from "../services/portfolio.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const income = await query<{ total: string }>(`SELECT COALESCE(SUM(amount),0) AS total FROM income`);
    const expense = await query<{ total: string }>(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`);
    const dividends = await query<{ total: string }>(
      `SELECT COALESCE(SUM(amount),0) AS total FROM income WHERE category='dividendos'`
    );

    const totalIncome = Decimal.from(income.rows[0].total);
    const totalExpense = Decimal.from(expense.rows[0].total);
    const balance = totalIncome.sub(totalExpense);

    const portfolio = await computePortfolio();
    // Net worth uses the estimated market value (A+B+C last known quote).
    const investedMarket = Decimal.from(portfolio.totals.estimatedValue);
    const netWorth = balance.add(investedMarket);

    // Monthly income vs expense series (last 6 months).
    const incomeByMonth = await query<{ month: string; total: string }>(`
      SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month, SUM(amount) AS total
      FROM income GROUP BY 1 ORDER BY 1 DESC LIMIT 6
    `);
    const expenseByMonth = await query<{ month: string; total: string }>(`
      SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month, SUM(amount) AS total
      FROM expenses GROUP BY 1 ORDER BY 1 DESC LIMIT 6
    `);

    const expenseByCategory = await query<{ category: string; total: string }>(`
      SELECT category, SUM(amount) AS total FROM expenses GROUP BY category ORDER BY total DESC
    `);

    ok(res, {
      balance: balance.toFixed(2),
      netWorth: netWorth.toFixed(2),
      income: totalIncome.toFixed(2),
      expenses: totalExpense.toFixed(2),
      investments: portfolio.totals.invested,
      investmentsMarket: portfolio.totals.estimatedValue,
      dividends: Decimal.from(dividends.rows[0].total).toFixed(2),
      portfolioReturnPct: portfolio.totals.returnPct,
      unpricedPositions: portfolio.totals.unpricedPositions,
      reliability: {
        countA: portfolio.totals.countA,
        countB: portfolio.totals.countB,
        countC: portfolio.totals.countC,
        blockedCount: portfolio.totals.blockedCount,
      },
      charts: {
        incomeByMonth: incomeByMonth.rows.reverse(),
        expenseByMonth: expenseByMonth.rows.reverse(),
        expenseByCategory: expenseByCategory.rows,
      },
    });
  })
);
