import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, reqEnum, reqString } from "../lib/http.js";
import { Decimal } from "../lib/decimal.js";

export const GOAL_TYPES = ["patrimonio", "investimentos", "economia", "renda_passiva"] as const;

export const goalsRouter = Router();

goalsRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT * FROM goals ORDER BY created_at DESC`);

    // Renda passiva por mês (dividendos + rendimentos) para meta mensal e estimativa.
    const passiveSeries = await query<{ month: string; total: string }>(`
      SELECT to_char(date_trunc('month', date), 'YYYY-MM') AS month, SUM(amount) AS total
      FROM income WHERE category IN ('dividendos','rendimentos')
      GROUP BY 1 ORDER BY 1
    `);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentMonthly = Decimal.from(
      passiveSeries.rows.find((r) => r.month === currentMonth)?.total ?? "0"
    );
    const passive = buildPassiveEstimate(passiveSeries.rows);

    const withProgress = rows.map((g) => {
      const target = Decimal.from(g.target);
      const current = Decimal.from(g.current);
      const base = {
        ...g,
        progressPct: target.isZero() ? "0.00" : current.div(target).mul(100).toFixed(2),
      };
      if (g.type !== "renda_passiva") return base;

      // Para renda passiva, o "alvo" é mensal e o "atual" é a renda do mês corrente.
      const monthlyProgress = target.isZero() ? "0.00" : currentMonthly.div(target).mul(100).toFixed(2);
      const estimate = estimateCompletion(currentMonthly, target, passive.monthlyGrowth);
      return {
        ...base,
        passive: {
          monthlyTarget: target.toFixed(2),
          currentMonthly: currentMonthly.toFixed(2),
          progressPct: monthlyProgress,
          monthlyGrowth: passive.monthlyGrowth.toFixed(2),
          estimateMonths: estimate.months,
          estimateDate: estimate.date,
        },
      };
    });
    ok(res, withProgress);
  })
);

goalsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const type = reqEnum(body, "type", GOAL_TYPES);
    const name = reqString(body, "name");
    const target = Decimal.from(body.target ?? "0");
    const current = Decimal.from(body.current ?? "0");
    const deadline = body.deadline ? String(body.deadline) : null;

    const { rows } = await query(
      `INSERT INTO goals (type, name, target, current, deadline) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [type, name, target.toFixed(2), current.toFixed(2), deadline]
    );
    await audit({ category: "change", entity: "goal", entityId: rows[0].id, action: "create", after: rows[0] });
    ok(res, rows[0], 201);
  })
);

goalsRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const current = Decimal.from(req.body?.current ?? "0");
    const { rows } = await query(
      `UPDATE goals SET current=$1, updated_at=now() WHERE id=$2 RETURNING *`,
      [current.toFixed(2), req.params.id]
    );
    if (rows.length === 0) throw new AppError(404, "Meta não encontrada");
    await audit({ category: "change", entity: "goal", entityId: req.params.id, action: "update_current", after: rows[0] });
    ok(res, rows[0]);
  })
);

goalsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`DELETE FROM goals WHERE id=$1 RETURNING *`, [req.params.id]);
    if (rows.length === 0) throw new AppError(404, "Meta não encontrada");
    await audit({ category: "change", entity: "goal", entityId: req.params.id, action: "delete", before: rows[0] });
    ok(res, rows[0]);
  })
);

/** Average month-over-month growth of passive income (auditable, simple linear). */
function buildPassiveEstimate(series: { month: string; total: string }[]): { monthlyGrowth: Decimal } {
  if (series.length < 2) return { monthlyGrowth: Decimal.zero() };
  const recent = series.slice(-6);
  let growth = Decimal.zero();
  let steps = 0;
  for (let i = 1; i < recent.length; i++) {
    growth = growth.add(Decimal.from(recent[i].total).sub(recent[i - 1].total));
    steps++;
  }
  return { monthlyGrowth: steps === 0 ? Decimal.zero() : growth.div(steps) };
}

/** Estimate months until monthly passive income reaches the target. */
function estimateCompletion(
  current: Decimal,
  target: Decimal,
  monthlyGrowth: Decimal
): { months: number | null; date: string | null } {
  if (current.cmp(target) >= 0) return { months: 0, date: new Date().toISOString().slice(0, 10) };
  if (monthlyGrowth.cmp(0) <= 0) return { months: null, date: null }; // sem tendência de crescimento
  const remaining = target.sub(current);
  const months = Math.ceil(remaining.div(monthlyGrowth).toNumber());
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return { months, date: date.toISOString().slice(0, 10) };
}
