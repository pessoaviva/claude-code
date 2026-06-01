import { query } from "../db/pool.js";
import { Decimal } from "../lib/decimal.js";
import { classify, computeScore, type Reliability, type ScoreBreakdown } from "../lib/reliability.js";

export interface Position {
  id: number;
  company: string;
  ticker: string;
  quantity: string;
  avgPrice: string;
  broker: string;
  purchaseDate: string;
  invested: string; // quantity * avgPrice
  currentPrice: string | null; // latest known quote, or null
  quoteSource: "auto" | "manual" | null;
  quoteProvider: string | null;
  quoteAt: string | null;
  currentValue: string | null; // quantity * currentPrice (last known)
  // Gated by reliability: only level A exposes profit/return.
  profitLoss: string | null;
  returnPct: string | null;
  reliability: Reliability;
  score: ScoreBreakdown;
}

export interface PortfolioTotals {
  invested: string; // cost basis of all positions
  officialValue: string; // market value of A+B positions
  estimatedValue: string; // market value of A+B+C (last known) positions
  difference: string; // estimated - official
  profitLoss: string; // over level-A positions only
  returnPct: string;
  countA: number;
  countB: number;
  countC: number;
  pricedPositions: number;
  unpricedPositions: number;
  blockedCount: number; // level C positions (excluded from official)
  blockedImpact: string; // estimated value the blocked positions represent
}

export interface PortfolioSummary {
  positions: Position[];
  totals: PortfolioTotals;
}

/**
 * Compute the full portfolio with A/B/C reliability classification.
 *
 * - Profit/Loss & rentabilidade are only exposed for level-A quotes.
 * - Official net-worth value uses A+B positions; estimated adds C (last quote).
 * - Each position carries an auditable 0–100 reliability score.
 */
export async function computePortfolio(): Promise<PortfolioSummary> {
  const stocks = await query<{
    id: number; company: string; ticker: string;
    quantity: string; avg_price: string; broker: string; purchase_date: string;
  }>(`SELECT id, company, ticker, quantity, avg_price, broker, purchase_date FROM stocks ORDER BY ticker`);

  const latest = await query<{
    ticker: string; price: string; source: "auto" | "manual"; provider: string | null; fetched_at: string;
  }>(`
    SELECT DISTINCT ON (ticker) ticker, price, source, provider, fetched_at
    FROM quotes ORDER BY ticker, fetched_at DESC
  `);
  const quoteMap = new Map(latest.rows.map((q) => [q.ticker.toUpperCase(), q]));

  // Per-ticker integration stats for scoring.
  const attemptStats = await query<{ ticker: string; ok: boolean; c: string }>(
    `SELECT ticker, ok, COUNT(*) AS c FROM quote_attempts GROUP BY ticker, ok`
  );
  const successMap = new Map<string, number>();
  const failureMap = new Map<string, number>();
  for (const r of attemptStats.rows) {
    const key = r.ticker.toUpperCase();
    (r.ok ? successMap : failureMap).set(key, Number(r.c));
  }

  // Recent prices (up to 5) per ticker for the consistency component + frequency.
  const recent = await query<{ ticker: string; price: string; rn: number }>(`
    SELECT ticker, price, rn FROM (
      SELECT ticker, price,
             ROW_NUMBER() OVER (PARTITION BY ticker ORDER BY fetched_at DESC) AS rn
      FROM quotes
    ) t WHERE rn <= 5 ORDER BY ticker, rn
  `);
  const recentMap = new Map<string, string[]>();
  for (const r of recent.rows) {
    const key = r.ticker.toUpperCase();
    const list = recentMap.get(key) ?? [];
    list.push(r.price);
    recentMap.set(key, list);
  }

  let invested = Decimal.zero();
  let officialValue = Decimal.zero();
  let estimatedValue = Decimal.zero();
  let reliableInvested = Decimal.zero();
  let reliableMarket = Decimal.zero();
  let blockedImpact = Decimal.zero();
  let countA = 0, countB = 0, countC = 0, priced = 0, unpriced = 0, blocked = 0;

  const positions: Position[] = stocks.rows.map((s) => {
    const key = s.ticker.toUpperCase();
    const qty = Decimal.from(s.quantity);
    const avg = Decimal.from(s.avg_price);
    const positionInvested = qty.mul(avg);
    invested = invested.add(positionInvested);

    const quote = quoteMap.get(key);
    const hasValidPrice = !!quote && Decimal.from(quote.price).cmp(0) > 0;
    const reliability = classify(quote?.fetched_at ?? null, hasValidPrice);

    let currentPrice: string | null = null;
    let positionValue: Decimal | null = null;
    let profitLoss: string | null = null;
    let returnPct: string | null = null;

    if (quote && hasValidPrice) {
      const price = Decimal.from(quote.price);
      positionValue = qty.mul(price);
      currentPrice = price.toFixed(8);
      priced++;
      if (reliability.countsOfficialNetWorth) officialValue = officialValue.add(positionValue);
      if (reliability.countsEstimatedNetWorth) estimatedValue = estimatedValue.add(positionValue);
      // Profit/return only for trustworthy (level A) quotes.
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
      id: s.id,
      company: s.company,
      ticker: s.ticker,
      quantity: qty.toFixed(8),
      avgPrice: avg.toFixed(8),
      broker: s.broker,
      purchaseDate: s.purchase_date,
      invested: positionInvested.toFixed(2),
      currentPrice,
      quoteSource: quote?.source ?? null,
      quoteProvider: quote?.provider ?? null,
      quoteAt: quote?.fetched_at ?? null,
      currentValue: positionValue ? positionValue.toFixed(2) : null,
      profitLoss,
      returnPct,
      reliability,
      score,
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
      pricedPositions: priced,
      unpricedPositions: unpriced,
      blockedCount: blocked,
      blockedImpact: blockedImpact.toFixed(2),
    },
  };
}
