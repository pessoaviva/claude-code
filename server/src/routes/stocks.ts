import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
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

// --- Aportes (contributions) -----------------------------------------------
// List aporte history (most recent first).
stocksRouter.get(
  "/contributions",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT * FROM stock_contributions ORDER BY date DESC, id DESC`);
    ok(res, rows);
  })
);

/**
 * Registrar aporte: integra automaticamente à carteira recalculando o preço
 * médio ponderado da posição (ou criando uma nova). `valor` = preço unitário.
 */
stocksRouter.post(
  "/aporte",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const ticker = reqString(body, "ticker").toUpperCase();
    const company = optString(body, "company");
    const note = optString(body, "note");
    const date = optString(body, "date") || new Date().toISOString().slice(0, 10);
    const qty = Decimal.from(body.quantity ?? "0");
    const unitPrice = Decimal.from(body.unitPrice ?? body.value ?? "0");
    if (qty.cmp(0) <= 0) throw new AppError(400, "quantity deve ser > 0");
    if (unitPrice.isNegative()) throw new AppError(400, "valor (preço unitário) inválido");

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        `SELECT * FROM stocks WHERE UPPER(ticker)=$1 ORDER BY id LIMIT 1 FOR UPDATE`,
        [ticker]
      );

      let position;
      if (existing.rows.length > 0) {
        const old = existing.rows[0];
        const oldQty = Decimal.from(old.quantity);
        const oldAvg = Decimal.from(old.avg_price);
        const newQty = oldQty.add(qty);
        // Preço médio ponderado: (qOld*pOld + qNew*pNew) / (qOld+qNew).
        const newAvg = newQty.isZero()
          ? Decimal.zero()
          : oldQty.mul(oldAvg).add(qty.mul(unitPrice)).div(newQty);
        const upd = await client.query(
          `UPDATE stocks SET quantity=$1, avg_price=$2, company=COALESCE(NULLIF($3,''), company), updated_at=now()
           WHERE id=$4 RETURNING *`,
          [newQty.toFixed(8), newAvg.toFixed(8), company, old.id]
        );
        position = upd.rows[0];
      } else {
        const ins = await client.query(
          `INSERT INTO stocks (company, ticker, quantity, avg_price, broker, purchase_date)
           VALUES ($1,$2,$3,$4,'',$5) RETURNING *`,
          [company || ticker, ticker, qty.toFixed(8), unitPrice.toFixed(8), date]
        );
        position = ins.rows[0];
      }

      const contrib = await client.query(
        `INSERT INTO stock_contributions (ticker, company, quantity, unit_price, date, note)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [ticker, company, qty.toFixed(8), unitPrice.toFixed(8), date, note]
      );
      await audit(
        { category: "change", entity: "stock_contribution", entityId: contrib.rows[0].id, action: "create", after: contrib.rows[0] },
        client
      );
      return { contribution: contrib.rows[0], position };
    });

    ok(res, { ...result, portfolio: await computePortfolio() }, 201);
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
