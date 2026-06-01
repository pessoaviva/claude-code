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
    const withProgress = rows.map((g) => {
      const target = Decimal.from(g.target);
      const current = Decimal.from(g.current);
      return {
        ...g,
        progressPct: target.isZero() ? "0.00" : current.div(target).mul(100).toFixed(2),
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
