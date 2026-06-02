/**
 * In-browser API — reimplements every backend endpoint against localStorage.
 * Same paths and response shapes the pages already use, so the UI is unchanged.
 * No server, no database. Auto quotes are unavailable offline (manual only).
 */
import { Decimal, sum as sumDec } from "./decimal";
import { classify, computeScore, type Reliability, type ScoreBreakdown } from "./reliability";
import { load, nextId, save, today, type DB, type Row } from "./store";

const INCOME_CATEGORIES = ["salario", "mesada", "vendas", "dividendos", "rendimentos", "outros"];
const EXPENSE_CATEGORIES = ["assinaturas", "saidas_casa", "alimentacao", "transporte", "saude", "educacao", "lazer", "outros"];
const GOAL_TYPES = ["patrimonio", "investimentos", "economia", "renda_passiva"];

// ---- helpers ---------------------------------------------------------------
const s = (v: unknown): string => String(v ?? "");
const dec = (v: unknown): Decimal => Decimal.from(s(v ?? "0"));

function reqString(o: Record<string, unknown>, k: string): string {
  const v = o[k];
  if (typeof v !== "string" || v.trim() === "") throw new Error(`Campo obrigatório ausente ou inválido: "${k}"`);
  return v.trim();
}
function optString(o: Record<string, unknown>, k: string, f = ""): string {
  const v = o[k];
  return typeof v === "string" ? v.trim() : f;
}
function reqEnum(o: Record<string, unknown>, k: string, allowed: string[]): string {
  const v = reqString(o, k);
  if (!allowed.includes(v)) throw new Error(`Valor inválido para "${k}". Permitidos: ${allowed.join(", ")}`);
  return v;
}

type AuditCategory = "change" | "quote" | "error" | "integration" | "manual";
function audit(db: DB, entry: { category: AuditCategory; entity: string; entityId?: string | null; action: string; details?: Record<string, unknown> }): void {
  db.audit_log.push({
    id: nextId("audit_log"),
    ts: new Date().toISOString(),
    category: entry.category,
    entity: entry.entity,
    entity_id: entry.entityId != null ? String(entry.entityId) : null,
    action: entry.action,
    actor: "browser",
    details: entry.details ?? {},
  });
}

function removeById(rows: Row[], id: string, notFound: string): Row {
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) throw new Error(notFound);
  return rows.splice(i, 1)[0];
}

function monthlySeries(rows: Row[]): { month: string; total: string }[] {
  const m = new Map<string, Decimal>();
  for (const r of rows) {
    const month = s(r.date).slice(0, 7);
    m.set(month, (m.get(month) ?? Decimal.zero()).add(s(r.amount)));
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, total]) => ({ month, total: total.toFixed(2) }));
}

// ---- portfolio (A/B/C, score, official/estimated) --------------------------
interface Position {
  id: string; company: string; ticker: string; quantity: string; avgPrice: string;
  broker: string; purchaseDate: string; invested: string; currentPrice: string | null;
  quoteSource: string | null; quoteProvider: string | null; quoteAt: string | null;
  currentValue: string | null; profitLoss: string | null; returnPct: string | null;
  reliability: Reliability; score: ScoreBreakdown;
}

function latestQuoteMap(db: DB): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const q of db.quotes) {
    const k = s(q.ticker).toUpperCase();
    const cur = map.get(k);
    if (!cur || new Date(s(q.fetched_at)).getTime() > new Date(s(cur.fetched_at)).getTime()) map.set(k, q);
  }
  return map;
}
function recentPricesMap(db: DB): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const sorted = [...db.quotes].sort((a, b) => new Date(s(b.fetched_at)).getTime() - new Date(s(a.fetched_at)).getTime());
  for (const q of sorted) {
    const k = s(q.ticker).toUpperCase();
    const list = map.get(k) ?? [];
    if (list.length < 5) {
      list.push(s(q.price));
      map.set(k, list);
    }
  }
  return map;
}

function computePortfolio(db: DB) {
  const quoteMap = latestQuoteMap(db);
  const recentMap = recentPricesMap(db);

  // quote_attempts is empty in offline mode, but keep the stats for the score.
  const successMap = new Map<string, number>();
  const failureMap = new Map<string, number>();
  for (const a of db.quote_attempts) {
    const k = s(a.ticker).toUpperCase();
    const t = a.ok ? successMap : failureMap;
    t.set(k, (t.get(k) ?? 0) + 1);
  }

  let invested = Decimal.zero();
  let officialValue = Decimal.zero();
  let estimatedValue = Decimal.zero();
  let reliableInvested = Decimal.zero();
  let reliableMarket = Decimal.zero();
  let blockedImpact = Decimal.zero();
  let countA = 0, countB = 0, countC = 0, priced = 0, unpriced = 0, blocked = 0;

  const stocks = [...db.stocks].sort((a, b) => (s(a.ticker) < s(b.ticker) ? -1 : 1));
  const positions: Position[] = stocks.map((st) => {
    const key = s(st.ticker).toUpperCase();
    const qty = dec(st.quantity);
    const avg = dec(st.avg_price);
    const positionInvested = qty.mul(avg);
    invested = invested.add(positionInvested);

    const quote = quoteMap.get(key);
    const hasValidPrice = !!quote && dec(quote.price).cmp(0) > 0;
    const reliability = classify(quote ? s(quote.fetched_at) : null, hasValidPrice);

    let currentPrice: string | null = null;
    let positionValue: Decimal | null = null;
    let profitLoss: string | null = null;
    let returnPct: string | null = null;

    if (quote && hasValidPrice) {
      const price = dec(quote.price);
      positionValue = qty.mul(price);
      currentPrice = price.toFixed(8);
      priced++;
      if (reliability.countsOfficialNetWorth) officialValue = officialValue.add(positionValue);
      if (reliability.countsEstimatedNetWorth) estimatedValue = estimatedValue.add(positionValue);
      if (reliability.allowProfit) {
        const profit = positionValue.sub(positionInvested);
        profitLoss = profit.toFixed(2);
        returnPct = positionInvested.isZero() ? "0.00" : profit.div(positionInvested).mul(100).toFixed(2);
        reliableInvested = reliableInvested.add(positionInvested);
        reliableMarket = reliableMarket.add(positionValue);
      }
    } else {
      unpriced++;
    }

    if (reliability.level === "A") countA++;
    else if (reliability.level === "B") countB++;
    else {
      countC++;
      blocked++;
      if (positionValue) blockedImpact = blockedImpact.add(positionValue);
    }

    const score = computeScore({
      successes: successMap.get(key) ?? 0,
      failures: failureMap.get(key) ?? 0,
      level: hasValidPrice ? reliability.level : null,
      recentQuoteCount: (recentMap.get(key) ?? []).length,
      recentPrices: recentMap.get(key) ?? [],
    });

    return {
      id: st.id, company: s(st.company), ticker: s(st.ticker),
      quantity: qty.toFixed(8), avgPrice: avg.toFixed(8), broker: s(st.broker),
      purchaseDate: s(st.purchase_date), invested: positionInvested.toFixed(2),
      currentPrice, quoteSource: quote ? s(quote.source) : null,
      quoteProvider: quote && quote.provider != null ? s(quote.provider) : null,
      quoteAt: quote ? s(quote.fetched_at) : null,
      currentValue: positionValue ? positionValue.toFixed(2) : null,
      profitLoss, returnPct, reliability, score,
    };
  });

  const totalProfit = reliableMarket.sub(reliableInvested);
  return {
    positions,
    totals: {
      invested: invested.toFixed(2),
      officialValue: officialValue.toFixed(2),
      estimatedValue: estimatedValue.toFixed(2),
      difference: estimatedValue.sub(officialValue).toFixed(2),
      profitLoss: totalProfit.toFixed(2),
      returnPct: reliableInvested.isZero() ? "0.00" : totalProfit.div(reliableInvested).mul(100).toFixed(2),
      countA, countB, countC,
      pricedPositions: priced, unpricedPositions: unpriced,
      blockedCount: blocked, blockedImpact: blockedImpact.toFixed(2),
    },
  };
}

// ---- router ----------------------------------------------------------------
function route(db: DB, method: string, path: string, query: URLSearchParams, body: Record<string, unknown>): unknown {
  // Dashboard
  if (method === "GET" && path === "/dashboard") {
    const income = sumDec(db.income.map((r) => s(r.amount)));
    const expenses = sumDec(db.expenses.map((r) => s(r.amount)));
    const dividends = sumDec(db.income.filter((r) => r.category === "dividendos").map((r) => s(r.amount)));
    const balance = income.sub(expenses);
    const portfolio = computePortfolio(db);
    const netWorth = balance.add(portfolio.totals.estimatedValue);
    const incomeByMonth = monthlySeries(db.income).slice(-6);
    const expenseByMonth = monthlySeries(db.expenses).slice(-6);
    const catMap = new Map<string, Decimal>();
    for (const e of db.expenses) catMap.set(s(e.category), (catMap.get(s(e.category)) ?? Decimal.zero()).add(s(e.amount)));
    const expenseByCategory = [...catMap.entries()].map(([category, total]) => ({ category, total: total.toFixed(2) })).sort((a, b) => Number(b.total) - Number(a.total));
    return {
      balance: balance.toFixed(2), netWorth: netWorth.toFixed(2),
      income: income.toFixed(2), expenses: expenses.toFixed(2),
      investments: portfolio.totals.invested, investmentsMarket: portfolio.totals.estimatedValue,
      dividends: dividends.toFixed(2), portfolioReturnPct: portfolio.totals.returnPct,
      unpricedPositions: portfolio.totals.unpricedPositions,
      reliability: { countA: portfolio.totals.countA, countB: portfolio.totals.countB, countC: portfolio.totals.countC, blockedCount: portfolio.totals.blockedCount },
      charts: { incomeByMonth, expenseByMonth, expenseByCategory },
    };
  }

  // Income & Expenses (shared logic)
  for (const cfg of [
    { base: "/income", table: "income" as const, cats: INCOME_CATEGORIES, entity: "income", notFound: "Ganho não encontrado" },
    { base: "/expenses", table: "expenses" as const, cats: EXPENSE_CATEGORIES, entity: "expense", notFound: "Gasto não encontrado" },
  ]) {
    if (path === cfg.base && method === "GET") {
      return [...db[cfg.table]].sort((a, b) => (s(a.date) < s(b.date) ? 1 : s(a.date) > s(b.date) ? -1 : Number(b.id) - Number(a.id)));
    }
    if (path === cfg.base && method === "POST") {
      const category = reqEnum(body, "category", cfg.cats);
      const amount = dec(body.amount);
      if (amount.isNegative()) throw new Error("amount não pode ser negativo");
      const row: Row = { id: nextId(cfg.table), date: optString(body, "date") || today(), category, description: optString(body, "description"), amount: amount.toFixed(2) };
      db[cfg.table].push(row);
      audit(db, { category: "change", entity: cfg.entity, entityId: row.id, action: "create" });
      return row;
    }
    if (path.startsWith(cfg.base + "/") && method === "DELETE") {
      const row = removeById(db[cfg.table], path.slice(cfg.base.length + 1), cfg.notFound);
      audit(db, { category: "change", entity: cfg.entity, entityId: row.id, action: "delete" });
      return row;
    }
  }

  // Stocks
  if (path === "/stocks" && method === "GET") return computePortfolio(db);
  if (path === "/stocks" && method === "POST") {
    const company = reqString(body, "company");
    const ticker = reqString(body, "ticker").toUpperCase();
    const quantity = dec(body.quantity);
    const avgPrice = dec(body.avgPrice);
    if (quantity.isNegative() || avgPrice.isNegative()) throw new Error("quantity e avgPrice não podem ser negativos");
    const row: Row = { id: nextId("stocks"), company, ticker, quantity: quantity.toFixed(8), avg_price: avgPrice.toFixed(8), broker: optString(body, "broker"), purchase_date: optString(body, "purchaseDate") || today() };
    db.stocks.push(row);
    audit(db, { category: "change", entity: "stock", entityId: row.id, action: "create" });
    return row;
  }
  if (path === "/stocks/contributions" && method === "GET") {
    return [...db.stock_contributions].sort((a, b) => (s(a.date) < s(b.date) ? 1 : -1));
  }
  if (path === "/stocks/aporte" && method === "POST") {
    const ticker = reqString(body, "ticker").toUpperCase();
    const company = optString(body, "company");
    const qty = dec(body.quantity);
    const unitPrice = Decimal.from(s(body.unitPrice ?? body.value ?? "0"));
    if (qty.cmp(0) <= 0) throw new Error("quantity deve ser > 0");
    if (unitPrice.isNegative()) throw new Error("valor (preço unitário) inválido");
    const existing = db.stocks.find((st) => s(st.ticker).toUpperCase() === ticker);
    let position: Row;
    if (existing) {
      const oldQty = dec(existing.quantity);
      const oldAvg = dec(existing.avg_price);
      const newQty = oldQty.add(qty);
      const newAvg = newQty.isZero() ? Decimal.zero() : oldQty.mul(oldAvg).add(qty.mul(unitPrice)).div(newQty);
      existing.quantity = newQty.toFixed(8);
      existing.avg_price = newAvg.toFixed(8);
      if (company) existing.company = company;
      position = existing;
    } else {
      position = { id: nextId("stocks"), company: company || ticker, ticker, quantity: qty.toFixed(8), avg_price: unitPrice.toFixed(8), broker: "", purchase_date: optString(body, "date") || today() };
      db.stocks.push(position);
    }
    const contribution: Row = { id: nextId("stock_contributions"), ticker, company, quantity: qty.toFixed(8), unit_price: unitPrice.toFixed(8), date: optString(body, "date") || today(), note: optString(body, "note") };
    db.stock_contributions.push(contribution);
    audit(db, { category: "change", entity: "stock_contribution", entityId: contribution.id, action: "create" });
    return { contribution, position, portfolio: computePortfolio(db) };
  }
  if (path.startsWith("/stocks/") && method === "DELETE") {
    const row = removeById(db.stocks, path.slice("/stocks/".length), "Ação não encontrada");
    audit(db, { category: "change", entity: "stock", entityId: row.id, action: "delete" });
    return row;
  }

  // Quotes
  if (path === "/quotes" && method === "GET") {
    const map = latestQuoteMap(db);
    return [...map.values()].map((q) => ({ ticker: q.ticker, price: q.price, source: q.source, provider: q.provider ?? null, fetched_at: q.fetched_at })).sort((a, b) => (s(a.ticker) < s(b.ticker) ? -1 : 1));
  }
  if (path === "/quotes/manual" && method === "POST") {
    const ticker = reqString(body, "ticker").toUpperCase();
    const price = dec(body.price);
    if (price.isNegative()) throw new Error("price não pode ser negativo");
    const row: Row = { id: nextId("quotes"), ticker, price: price.toFixed(8), source: "manual", provider: null, fetched_at: new Date().toISOString() };
    db.quotes.push(row);
    audit(db, { category: "manual", entity: "quote", entityId: ticker, action: "update_manual", details: { price: row.price } });
    return { quote: row, portfolio: computePortfolio(db) };
  }
  if (path.startsWith("/quotes/auto/") && method === "POST") {
    const ticker = path.slice("/quotes/auto/".length).toUpperCase();
    audit(db, { category: "error", entity: "quote", entityId: ticker, action: "fetch_auto_unavailable", details: { reason: "offline" } });
    throw new Error(`Cotação automática indisponível no modo offline (sem servidor). Informe o preço de ${ticker} manualmente.`);
  }

  // Net worth
  if (path === "/networth" && method === "GET") {
    const cash = sumDec(db.income.map((r) => s(r.amount))).sub(sumDec(db.expenses.map((r) => s(r.amount))));
    const portfolio = computePortfolio(db);
    const stocksOfficial = Decimal.from(portfolio.totals.officialValue);
    const stocksEstimated = Decimal.from(portfolio.totals.estimatedValue);
    const officialAssets = sumDec(db.assets.map((a) => s(a.official_value)));
    const estimatedAssets = sumDec(db.assets.map((a) => s(a.estimated_value)));
    const official = cash.add(officialAssets).add(stocksOfficial);
    const estimated = cash.add(estimatedAssets).add(stocksEstimated);
    const blocked = portfolio.positions.filter((p) => p.reliability.level === "C").map((p) => ({ ticker: p.ticker, company: p.company, reason: p.reliability.reason, estimatedValue: p.currentValue }));
    return {
      official: official.toFixed(2), estimated: estimated.toFixed(2), difference: estimated.sub(official).toFixed(2),
      cash: cash.toFixed(2), stocksInvested: portfolio.totals.invested, stocksOfficial: stocksOfficial.toFixed(2), stocksEstimated: stocksEstimated.toFixed(2),
      reliability: { countA: portfolio.totals.countA, countB: portfolio.totals.countB, countC: portfolio.totals.countC },
      partial: { isPartial: portfolio.totals.blockedCount > 0, blockedCount: portfolio.totals.blockedCount, blockedImpact: portfolio.totals.blockedImpact, reason: "Ativos sem cotação confiável (nível C) ficam fora do patrimônio oficial.", blocked },
      assets: [...db.assets].sort((a, b) => (s(a.type) < s(b.type) ? -1 : 1)),
      distribution: [
        { label: "Caixa", value: cash.toFixed(2) },
        { label: "Ações (A+B)", value: stocksOfficial.toFixed(2) },
        { label: "Ações nível C", value: portfolio.totals.blockedImpact },
        { label: "Outros ativos", value: estimatedAssets.toFixed(2) },
      ],
    };
  }
  if (path === "/networth/assets" && method === "POST") {
    const name = reqString(body, "name");
    const official = dec(body.officialValue);
    const estimated = body.estimatedValue != null && s(body.estimatedValue) !== "" ? dec(body.estimatedValue) : official;
    const row: Row = { id: nextId("assets"), name, type: optString(body, "type", "outros"), official_value: official.toFixed(2), estimated_value: estimated.toFixed(2), as_of: optString(body, "asOf") || today() };
    db.assets.push(row);
    audit(db, { category: "change", entity: "asset", entityId: row.id, action: "create" });
    return row;
  }
  if (path.startsWith("/networth/assets/") && method === "DELETE") {
    const row = removeById(db.assets, path.slice("/networth/assets/".length), "Ativo não encontrado");
    audit(db, { category: "change", entity: "asset", entityId: row.id, action: "delete" });
    return row;
  }

  // Sales / inventory
  if (path === "/sales/products" && method === "GET") return [...db.products].sort((a, b) => (s(a.name) < s(b.name) ? -1 : 1));
  if (path === "/sales/products" && method === "POST") {
    const sku = reqString(body, "sku");
    const name = reqString(body, "name");
    if (db.products.some((p) => p.sku === sku)) throw new Error(`SKU "${sku}" já existe`);
    const row: Row = { id: nextId("products"), sku, name, stock_qty: "0.000" };
    db.products.push(row);
    audit(db, { category: "change", entity: "product", entityId: row.id, action: "create" });
    return row;
  }
  if (path === "/sales/purchases" && method === "POST") {
    const product = db.products.find((p) => p.id === s(body.productId));
    if (!product) throw new Error("Produto não encontrado");
    const qty = dec(body.qty);
    const unitCost = dec(body.unitCost);
    if (qty.cmp(0) <= 0) throw new Error("qty deve ser > 0");
    if (unitCost.isNegative()) throw new Error("unitCost inválido");
    const purchase: Row = { id: nextId("purchases"), product_id: product.id, qty: qty.toFixed(3), unit_cost: unitCost.toFixed(2), date: optString(body, "date") || today(), note: optString(body, "note") };
    db.purchases.push(purchase);
    product.stock_qty = dec(product.stock_qty).add(qty).toFixed(3);
    audit(db, { category: "change", entity: "purchase", entityId: purchase.id, action: "create" });
    return { purchase, product };
  }
  if (path === "/sales/sales" && method === "POST") {
    const product = db.products.find((p) => p.id === s(body.productId));
    if (!product) throw new Error("Produto não encontrado");
    const qty = dec(body.qty);
    const unitPrice = dec(body.unitPrice);
    if (qty.cmp(0) <= 0) throw new Error("qty deve ser > 0");
    if (unitPrice.isNegative()) throw new Error("unitPrice inválido");
    const stock = dec(product.stock_qty);
    if (stock.cmp(qty) < 0) throw new Error(`Estoque insuficiente: disponível ${stock.toFixed(3)}, solicitado ${qty.toFixed(3)}`);
    const prods = db.purchases.filter((p) => p.product_id === product.id);
    const totalQty = sumDec(prods.map((p) => s(p.qty)));
    const totalCost = prods.reduce((acc, p) => acc.add(dec(p.qty).mul(s(p.unit_cost))), Decimal.zero());
    const unitCost = totalQty.isZero() ? Decimal.zero() : totalCost.div(totalQty);
    const sale: Row = { id: nextId("sales"), product_id: product.id, qty: qty.toFixed(3), unit_price: unitPrice.toFixed(2), unit_cost: unitCost.toFixed(2), date: optString(body, "date") || today() };
    db.sales.push(sale);
    product.stock_qty = stock.sub(qty).toFixed(3);
    audit(db, { category: "change", entity: "sale", entityId: sale.id, action: "create" });
    return { sale, product };
  }
  if (path === "/sales/profit" && method === "GET") {
    const byProduct = new Map<string, { name: string; sku: string; revenue: Decimal; cogs: Decimal; qty: Decimal }>();
    for (const sale of db.sales) {
      const product = db.products.find((p) => p.id === sale.product_id);
      if (!product) continue;
      const entry = byProduct.get(s(product.id)) ?? { name: s(product.name), sku: s(product.sku), revenue: Decimal.zero(), cogs: Decimal.zero(), qty: Decimal.zero() };
      const qty = dec(sale.qty);
      entry.revenue = entry.revenue.add(qty.mul(s(sale.unit_price)));
      entry.cogs = entry.cogs.add(qty.mul(s(sale.unit_cost)));
      entry.qty = entry.qty.add(qty);
      byProduct.set(s(product.id), entry);
    }
    return [...byProduct.entries()].map(([productId, e]) => {
      const profit = e.revenue.sub(e.cogs);
      return { productId, name: e.name, sku: e.sku, qtySold: e.qty.toFixed(3), revenue: e.revenue.toFixed(2), cogs: e.cogs.toFixed(2), profit: profit.toFixed(2), marginPct: e.revenue.isZero() ? "0.00" : profit.div(e.revenue).mul(100).toFixed(2) };
    });
  }

  // Goals
  if (path === "/goals" && method === "GET") {
    const currentMonth = today().slice(0, 7);
    const passiveRows = db.income.filter((r) => r.category === "dividendos" || r.category === "rendimentos");
    const series = monthlySeries(passiveRows);
    const currentMonthly = Decimal.from(series.find((x) => x.month === currentMonth)?.total ?? "0");
    const growth = passiveGrowth(series);
    return [...db.goals].sort((a, b) => Number(b.id) - Number(a.id)).map((g) => {
      const target = dec(g.target);
      const current = dec(g.current);
      const base = { ...g, progressPct: target.isZero() ? "0.00" : current.div(target).mul(100).toFixed(2) };
      if (g.type !== "renda_passiva") return base;
      const monthlyProgress = target.isZero() ? "0.00" : currentMonthly.div(target).mul(100).toFixed(2);
      const est = estimateCompletion(currentMonthly, target, growth);
      return { ...base, passive: { monthlyTarget: target.toFixed(2), currentMonthly: currentMonthly.toFixed(2), progressPct: monthlyProgress, monthlyGrowth: growth.toFixed(2), estimateMonths: est.months, estimateDate: est.date } };
    });
  }
  if (path === "/goals" && method === "POST") {
    const type = reqEnum(body, "type", GOAL_TYPES);
    const name = reqString(body, "name");
    const row: Row = { id: nextId("goals"), type, name, target: dec(body.target).toFixed(2), current: dec(body.current).toFixed(2), deadline: body.deadline ? s(body.deadline) : null };
    db.goals.push(row);
    audit(db, { category: "change", entity: "goal", entityId: row.id, action: "create" });
    return row;
  }
  if (path.startsWith("/goals/") && method === "PATCH") {
    const id = path.slice("/goals/".length);
    const goal = db.goals.find((g) => g.id === id);
    if (!goal) throw new Error("Meta não encontrada");
    goal.current = dec(body.current).toFixed(2);
    audit(db, { category: "change", entity: "goal", entityId: id, action: "update_current" });
    return goal;
  }
  if (path.startsWith("/goals/") && method === "DELETE") {
    const row = removeById(db.goals, path.slice("/goals/".length), "Meta não encontrada");
    audit(db, { category: "change", entity: "goal", entityId: row.id, action: "delete" });
    return row;
  }

  // Audit
  if (path === "/audit/logs" && method === "GET") {
    const category = query.get("category");
    const limit = Math.min(Number(query.get("limit")) || 100, 500);
    let rows = [...db.audit_log].sort((a, b) => (s(a.ts) < s(b.ts) ? 1 : -1));
    if (category && category !== "all") rows = rows.filter((r) => r.category === category);
    return rows.slice(0, limit);
  }
  if (path === "/audit/diagnostics" && method === "GET") {
    const counts = new Map<string, number>();
    for (const l of db.audit_log) counts.set(s(l.category), (counts.get(s(l.category)) ?? 0) + 1);
    const dayAgo = Date.now() - 24 * 3600 * 1000;
    const errors24h = db.audit_log.filter((l) => l.category === "error" && new Date(s(l.ts)).getTime() > dayAgo).length;
    return {
      database: { ok: true, latencyMs: 0 },
      errors24h, uptimeSec: Math.round(performance.now() / 1000),
      auditCounts: [...counts.entries()].map(([category, count]) => ({ category, count: String(count) })),
    };
  }

  // Diagnostics
  if (path === "/diagnostics" && method === "GET") {
    const portfolio = computePortfolio(db);
    const providers = ["brapi", "yahoo", "alphavantage", "finnhub"].map((name) => ({ name, configured: false, disabledReason: "Modo offline (navegador) — sem provedores", online: false, successes: 0, failures: 0, avgResponseMs: null, lastAt: null, lastSuccessAt: null }));
    return {
      providers,
      health: { assetsA: portfolio.totals.countA, assetsB: portfolio.totals.countB, assetsC: portfolio.totals.countC, apisOnline: 0, apisOffline: 0, apisDisabled: providers.length, lastSync: null, avgResponseMs: null },
    };
  }
  if (path === "/diagnostics/assets" && method === "GET") {
    const portfolio = computePortfolio(db);
    return portfolio.positions.map((p) => ({
      ticker: p.ticker, source: p.quoteSource, provider: p.quoteProvider, url: null, lastResponse: null,
      at: p.quoteAt, responseMs: null, status: p.quoteSource ? "manual (offline)" : "sem cotação",
      lastError: null, level: p.reliability.level, levelLabel: p.reliability.label, score: p.score.score, scoreBreakdown: p.score,
    }));
  }

  if (path === "/health" && method === "GET") return { ok: true, service: "fintrack-pro", mode: "browser", time: new Date().toISOString() };

  throw new Error(`Rota não encontrada: ${method} ${path}`);
}

function passiveGrowth(series: { month: string; total: string }[]): Decimal {
  if (series.length < 2) return Decimal.zero();
  const recent = series.slice(-6);
  let growth = Decimal.zero();
  let steps = 0;
  for (let i = 1; i < recent.length; i++) {
    growth = growth.add(Decimal.from(recent[i].total).sub(recent[i - 1].total));
    steps++;
  }
  return steps === 0 ? Decimal.zero() : growth.div(steps);
}

function estimateCompletion(current: Decimal, target: Decimal, growth: Decimal): { months: number | null; date: string | null } {
  if (current.cmp(target) >= 0) return { months: 0, date: today() };
  if (growth.cmp(0) <= 0) return { months: null, date: null };
  const months = Math.ceil(target.sub(current).div(growth).toNumber());
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return { months, date: d.toISOString().slice(0, 10) };
}

/** Public entrypoint used by the api client. Mirrors HTTP semantics. */
export async function handle(method: string, rawPath: string, body?: unknown): Promise<unknown> {
  const db = load();
  const [path, queryStr] = rawPath.split("?");
  const query = new URLSearchParams(queryStr ?? "");
  const result = route(db, method, path, query, (body as Record<string, unknown>) ?? {});
  save();
  return result;
}
