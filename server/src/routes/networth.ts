import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, optString, reqString } from "../lib/http.js";
import { Decimal, sum } from "../lib/decimal.js";
import { computePortfolio } from "../services/portfolio.js";

export const networthRouter = Router();

/**
 * Patrimônio:
 *  - oficial   = soma dos valores oficiais dos ativos cadastrados + caixa (ganhos - gastos)
 *  - estimado  = oficial, mas usando carteira de ações a mercado quando houver cotação
 *  - distribuição dos ativos e evolução patrimonial
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
    const investedOfficial = Decimal.from(portfolio.totals.invested);
    const investedMarket = Decimal.from(portfolio.totals.currentValue);

    const officialAssets = sum(assets.rows.map((a) => a.official_value));
    const estimatedAssets = sum(assets.rows.map((a) => a.estimated_value));

    // Official: caixa + ativos oficiais + ações ao preço médio (custo).
    const official = cash.add(officialAssets).add(investedOfficial);
    // Estimated: caixa + ativos estimados + ações a mercado (cotação atual).
    const estimated = cash.add(estimatedAssets).add(investedMarket);

    const distribution = [
      { label: "Caixa", value: cash.toFixed(2) },
      { label: "Ações (mercado)", value: investedMarket.toFixed(2) },
      { label: "Outros ativos", value: estimatedAssets.toFixed(2) },
    ];

    ok(res, {
      official: official.toFixed(2),
      estimated: estimated.toFixed(2),
      cash: cash.toFixed(2),
      stocksInvested: investedOfficial.toFixed(2),
      stocksMarket: investedMarket.toFixed(2),
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
