import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, optString, reqString } from "../lib/http.js";
import { Decimal } from "../lib/decimal.js";
import { computePortfolio } from "../services/portfolio.js";

export const stocksRouter = Router();

// Full computed portfolio (valor investido, atual, lucro/prejuízo, rentabilidade).
stocksRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    ok(res, await computePortfolio());
  })
);

stocksRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const company = reqString(body, "company");
    const ticker = reqString(body, "ticker").toUpperCase();
    const broker = optString(body, "broker");
    const purchaseDate = optString(body, "purchaseDate") || new Date().toISOString().slice(0, 10);
    const quantity = Decimal.from(body.quantity ?? "0");
    const avgPrice = Decimal.from(body.avgPrice ?? "0");
    if (quantity.isNegative() || avgPrice.isNegative()) {
      throw new AppError(400, "quantity e avgPrice não podem ser negativos");
    }

    const { rows } = await query(
      `INSERT INTO stocks (company, ticker, quantity, avg_price, broker, purchase_date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [company, ticker, quantity.toFixed(8), avgPrice.toFixed(8), broker, purchaseDate]
    );
    await audit({ category: "change", entity: "stock", entityId: rows[0].id, action: "create", after: rows[0] });
    ok(res, rows[0], 201);
  })
);

stocksRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`DELETE FROM stocks WHERE id=$1 RETURNING *`, [req.params.id]);
    if (rows.length === 0) throw new AppError(404, "Ação não encontrada");
    await audit({ category: "change", entity: "stock", entityId: req.params.id, action: "delete", before: rows[0] });
    ok(res, rows[0]);
  })
);
