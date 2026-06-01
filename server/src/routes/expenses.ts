import { Router } from "express";
import { query } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, optString, reqEnum } from "../lib/http.js";
import { Decimal } from "../lib/decimal.js";

export const EXPENSE_CATEGORIES = [
  "assinaturas",
  "saidas_casa",
  "alimentacao",
  "transporte",
  "saude",
  "educacao",
  "lazer",
  "outros",
] as const;

export const expensesRouter = Router();

expensesRouter.get(
  "/",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT * FROM expenses ORDER BY date DESC, id DESC`);
    ok(res, rows);
  })
);

expensesRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const category = reqEnum(body, "category", EXPENSE_CATEGORIES);
    const description = optString(body, "description");
    const date = optString(body, "date") || new Date().toISOString().slice(0, 10);
    const amount = Decimal.from(body.amount ?? "0");
    if (amount.isNegative()) throw new AppError(400, "amount não pode ser negativo");

    const { rows } = await query(
      `INSERT INTO expenses (date, category, description, amount) VALUES ($1,$2,$3,$4) RETURNING *`,
      [date, category, description, amount.toFixed(2)]
    );
    await audit({ category: "change", entity: "expense", entityId: rows[0].id, action: "create", after: rows[0] });
    ok(res, rows[0], 201);
  })
);

expensesRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { rows } = await query(`DELETE FROM expenses WHERE id=$1 RETURNING *`, [req.params.id]);
    if (rows.length === 0) throw new AppError(404, "Gasto não encontrado");
    await audit({ category: "change", entity: "expense", entityId: req.params.id, action: "delete", before: rows[0] });
    ok(res, rows[0]);
  })
);
