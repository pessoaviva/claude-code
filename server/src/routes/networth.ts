import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, optString, reqString } from "../lib/http.js";
import { Decimal, sum } from "../lib/decimal.js";
import { computePortfolio } from "../services/portfolio.js";

export const networthRouter = Router();

/**
 * Patrimônio com classificação A/B/C das cotações:
 *  - OFICIAL  = caixa + ativos oficiais + ações em nível A e B (a mercado).
 *  - ESTIMADO = caixa + ativos estimados + ações A, B e C (última cotação conhecida).
 *  - DIFERENÇA = estimado − oficial.
 *  - PARCIAL  = quando há ações nível C (bloqueadas): conta, impacto e motivo.
 */
networthRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const assets = await query<{
      id: number; name: string; type: string;
      official_value: string; estimated_value: string; as_of: string;
    }>(`SELECT * FROM assets ORDER BY type, name`);

    const incomeTotal = await query<{ total: string }>(`SELECT COALESCE(SUM(amount),0) AS total FROM income`);
    const expenseTotal = await query<{ total: string }>(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses`);
    const cash = Decimal.from(incomeTotal.rows[0].total).sub(expenseTotal.rows[0].total);

    const portfolio = await computePortfolio();
    const stocksOfficial = Decimal.from(portfolio.totals.officialValue); // A + B
    const stocksEstimated = Decimal.from(portfolio.totals.estimatedValue); // A + B + C

    const officialAssets = sum(assets.rows.map((a) => a.official_value));
    const estimatedAssets = sum(assets.rows.map((a) => a.estimated_value));

    const official = cash.add(officialAssets).add(stocksOfficial);
    const estimated = cash.add(estimatedAssets).add(stocksEstimated);
    const difference = estimated.sub(official);

    // Ativos bloqueados (nível C) compõem o aviso de "Patrimônio Parcial".
    const blocked = portfolio.positions
      .filter((p) => p.reliability.level === "C")
      .map((p) => ({
        ticker: p.ticker,
        company: p.company,
        reason: p.reliability.reason,
        estimatedValue: p.currentValue, // última cotação conhecida (ou null)
      }));

    const distribution = [
      { label: "Caixa", value: cash.toFixed(2) },
      { label: "Ações (A+B)", value: stocksOfficial.toFixed(2) },
      { label: "Ações nível C", value: Decimal.from(portfolio.totals.blockedImpact).toFixed(2) },
      { label: "Outros ativos", value: estimatedAssets.toFixed(2) },
    ];

    ok(res, {
      official: official.toFixed(2),
      estimated: estimated.toFixed(2),
      difference: difference.toFixed(2),
      cash: cash.toFixed(2),
      stocksInvested: portfolio.totals.invested,
      stocksOfficial: stocksOfficial.toFixed(2),
      stocksEstimated: stocksEstimated.toFixed(2),
      reliability: {
        countA: portfolio.totals.countA,
        countB: portfolio.totals.countB,
        countC: portfolio.totals.countC,
      },
      partial: {
        isPartial: portfolio.totals.blockedCount > 0,
        blockedCount: portfolio.totals.blockedCount,
        blockedImpact: portfolio.totals.blockedImpact,
        reason: "Ativos sem cotação confiável (nível C) ficam fora do patrimônio oficial.",
        blocked,
      },
      assets: assets.rows,
      distribution,
    });
  })
);

networthRouter.post(
  "/assets",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const name = reqString(body, "name");
    const type = optString(body, "type", "outros");
    const official = Decimal.from(body.officialValue ?? "0");
    const estimated = Decimal.from(body.estimatedValue ?? body.officialValue ?? "0");
    const asOf = optString(body, "asOf") || new Date().toISOString().slice(0, 10);

    const { rows } = await query(
      `INSERT INTO assets (name, type, official_value, estimated_value, as_of)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, type, official.toFixed(2), estimated.toFixed(2), asOf]
    );
    await audit({ category: "change", entity: "asset", entityId: rows[0].id, action: "create", after: rows[0] });
    ok(res, rows[0], 201);
  })
);

networthRouter.delete(
  "/assets/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`DELETE FROM assets WHERE id=$1 RETURNING *`, [req.params.id]);
    if (rows.length === 0) throw new AppError(404, "Ativo não encontrado");
    await audit({ category: "change", entity: "asset", entityId: req.params.id, action: "delete", before: rows[0] });
    ok(res, rows[0]);
  })
);
