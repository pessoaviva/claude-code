import { Router } from "express";
import { query, withTransaction } from "../db/pool.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { audit } from "../lib/audit.js";
import { AppError, ok, optString, reqString } from "../lib/http.js";
import { Decimal } from "../lib/decimal.js";

export const salesRouter = Router();

// --- Products ---------------------------------------------------------------
salesRouter.get(
  "/products",
  asyncHandler(async (_req, res) => {
    const { rows } = await query(`SELECT * FROM products ORDER BY name`);
    ok(res, rows);
  })
);

salesRouter.post(
  "/products",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const sku = reqString(body, "sku");
    const name = reqString(body, "name");
    try {
      const { rows } = await query(
        `INSERT INTO products (sku, name) VALUES ($1,$2) RETURNING *`,
        [sku, name]
      );
      await audit({ category: "change", entity: "product", entityId: rows[0].id, action: "create", after: rows[0] });
      ok(res, rows[0], 201);
    } catch (err: any) {
      if (err?.code === "23505") throw new AppError(409, `SKU "${sku}" já existe`);
      throw err;
    }
  })
);

// --- Purchases (entrada de estoque) ----------------------------------------
salesRouter.post(
  "/purchases",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const productId = Number(body.productId);
    const qty = Decimal.from(body.qty ?? "0");
    const unitCost = Decimal.from(body.unitCost ?? "0");
    if (!productId) throw new AppError(400, "productId obrigatório");
    if (qty.cmp(0) <= 0) throw new AppError(400, "qty deve ser > 0");
    if (unitCost.isNegative()) throw new AppError(400, "unitCost inválido");
    const date = optString(body, "date") || new Date().toISOString().slice(0, 10);
    const note = optString(body, "note"); // observação do aporte

    const result = await withTransaction(async (client) => {
      const prod = await client.query(`SELECT * FROM products WHERE id=$1 FOR UPDATE`, [productId]);
      if (prod.rows.length === 0) throw new AppError(404, "Produto não encontrado");
      const purchase = await client.query(
        `INSERT INTO purchases (product_id, qty, unit_cost, date, note) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [productId, qty.toFixed(3), unitCost.toFixed(2), date, note]
      );
      const newStock = Decimal.from(prod.rows[0].stock_qty).add(qty);
      const updated = await client.query(
        `UPDATE products SET stock_qty=$1, updated_at=now() WHERE id=$2 RETURNING *`,
        [newStock.toFixed(3), productId]
      );
      await audit(
        { category: "change", entity: "purchase", entityId: purchase.rows[0].id, action: "create", after: purchase.rows[0] },
        client
      );
      return { purchase: purchase.rows[0], product: updated.rows[0] };
    });
    ok(res, result, 201);
  })
);

// --- Sales (saída de estoque) ----------------------------------------------
salesRouter.post(
  "/sales",
  asyncHandler(async (req, res) => {
    const body = req.body ?? {};
    const productId = Number(body.productId);
    const qty = Decimal.from(body.qty ?? "0");
    const unitPrice = Decimal.from(body.unitPrice ?? "0");
    if (!productId) throw new AppError(400, "productId obrigatório");
    if (qty.cmp(0) <= 0) throw new AppError(400, "qty deve ser > 0");
    if (unitPrice.isNegative()) throw new AppError(400, "unitPrice inválido");
    const date = optString(body, "date") || new Date().toISOString().slice(0, 10);

    const result = await withTransaction(async (client) => {
      const prod = await client.query(`SELECT * FROM products WHERE id=$1 FOR UPDATE`, [productId]);
      if (prod.rows.length === 0) throw new AppError(404, "Produto não encontrado");
      const stock = Decimal.from(prod.rows[0].stock_qty);
      if (stock.cmp(qty) < 0) {
        throw new AppError(409, `Estoque insuficiente: disponível ${stock.toFixed(3)}, solicitado ${qty.toFixed(3)}`);
      }
      // COGS via custo médio ponderado das compras (auditável e estável).
      const avg = await client.query<{ total_qty: string | null; total_cost: string | null }>(
        `SELECT COALESCE(SUM(qty),0) AS total_qty, COALESCE(SUM(qty*unit_cost),0) AS total_cost
         FROM purchases WHERE product_id=$1`,
        [productId]
      );
      const totalQty = Decimal.from(avg.rows[0].total_qty ?? "0");
      const totalCost = Decimal.from(avg.rows[0].total_cost ?? "0");
      const unitCost = totalQty.isZero() ? Decimal.zero() : totalCost.div(totalQty);

      const sale = await client.query(
        `INSERT INTO sales (product_id, qty, unit_price, unit_cost, date) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [productId, qty.toFixed(3), unitPrice.toFixed(2), unitCost.toFixed(2), date]
      );
      const updated = await client.query(
        `UPDATE products SET stock_qty=$1, updated_at=now() WHERE id=$2 RETURNING *`,
        [stock.sub(qty).toFixed(3), productId]
      );
      await audit(
        { category: "change", entity: "sale", entityId: sale.rows[0].id, action: "create", after: sale.rows[0] },
        client
      );
      return { sale: sale.rows[0], product: updated.rows[0] };
    });
    ok(res, result, 201);
  })
);

// --- Profit per product -----------------------------------------------------
salesRouter.get(
  "/profit",
  asyncHandler(async (_req, res) => {
    const sales = await query<{
      product_id: number; name: string; sku: string;
      qty: string; unit_price: string; unit_cost: string;
    }>(`
      SELECT s.product_id, p.name, p.sku, s.qty, s.unit_price, s.unit_cost
      FROM sales s JOIN products p ON p.id = s.product_id
    `);

    const byProduct = new Map<number, { name: string; sku: string; revenue: Decimal; cogs: Decimal; qty: Decimal }>();
    for (const s of sales.rows) {
      const entry = byProduct.get(s.product_id) ?? {
        name: s.name, sku: s.sku, revenue: Decimal.zero(), cogs: Decimal.zero(), qty: Decimal.zero(),
      };
      const qty = Decimal.from(s.qty);
      entry.revenue = entry.revenue.add(qty.mul(s.unit_price));
      entry.cogs = entry.cogs.add(qty.mul(s.unit_cost));
      entry.qty = entry.qty.add(qty);
      byProduct.set(s.product_id, entry);
    }

    const rows = [...byProduct.entries()].map(([productId, e]) => {
      const profit = e.revenue.sub(e.cogs);
      return {
        productId,
        name: e.name,
        sku: e.sku,
        qtySold: e.qty.toFixed(3),
        revenue: e.revenue.toFixed(2),
        cogs: e.cogs.toFixed(2),
        profit: profit.toFixed(2),
        marginPct: e.revenue.isZero() ? "0.00" : profit.div(e.revenue).mul(100).toFixed(2),
      };
    });
    ok(res, rows);
  })
);
