import { query } from "../db/pool.js";
import { Decimal } from "../lib/decimal.js";

export interface Position {
  id: number;
  company: string;
  ticker: string;
  quantity: string;
  avgPrice: string;
  broker: string;
  purchaseDate: string;
  invested: string; // quantity * avgPrice
  currentPrice: string | null; // latest quote, or null if none yet
  quoteSource: "auto" | "manual" | null;
  quoteAt: string | null;
  currentValue: string | null; // quantity * currentPrice
  profitLoss: string | null; // currentValue - invested
  returnPct: string | null; // profitLoss / invested * 100
}

export interface PortfolioSummary {
  positions: Position[];
  totals: {
    invested: string;
    currentValue: string;
    profitLoss: string;
    returnPct: string;
    pricedPositions: number;
    unpricedPositions: number; // positions with no quote yet
  };
}

/**
 * Compute the full portfolio. Quantities/prices come from the DB as exact
 * strings; all math is fixed-point. Positions without a quote are returned with
 * null current values and excluded from current-value totals (never guessed).
 */
export async function computePortfolio(): Promise<PortfolioSummary> {
  const stocks = await query<{
    id: number;
    company: string;
    ticker: string;
    quantity: string;
    avg_price: string;
    broker: string;
    purchase_date: string;
  }>(`SELECT id, company, ticker, quantity, avg_price, broker, purchase_date FROM stocks ORDER BY ticker`);

  // Latest quote per ticker.
  const latest = await query<{
    ticker: string;
    price: string;
    source: "auto" | "manual";
    fetched_at: string;
  }>(`
    SELECT DISTINCT ON (ticker) ticker, price, source, fetched_at
    FROM quotes
    ORDER BY ticker, fetched_at DESC
  `);
  const quoteMap = new Map(latest.rows.map((q) => [q.ticker.toUpperCase(), q]));

  let invested = Decimal.zero();
  let currentValue = Decimal.zero();
  let priced = 0;
  let unpriced = 0;

  const positions: Position[] = stocks.rows.map((s) => {
    const qty = Decimal.from(s.quantity);
    const avg = Decimal.from(s.avg_price);
    const positionInvested = qty.mul(avg);
    invested = invested.add(positionInvested);

    const quote = quoteMap.get(s.ticker.toUpperCase());
    let currentPrice: string | null = null;
    let positionValue: Decimal | null = null;
    let pnl: string | null = null;
    let returnPct: string | null = null;
    let quoteSource: "auto" | "manual" | null = null;
    let quoteAt: string | null = null;

    if (quote) {
      const price = Decimal.from(quote.price);
      positionValue = qty.mul(price);
      currentValue = currentValue.add(positionValue);
      currentPrice = price.toFixed(8);
      quoteSource = quote.source;
      quoteAt = quote.fetched_at;
      const profit = positionValue.sub(positionInvested);
      pnl = profit.toFixed(2);
      returnPct = positionInvested.isZero()
        ? "0.00"
        : profit.div(positionInvested).mul(100).toFixed(2);
      priced++;
    } else {
      unpriced++;
    }

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
      quoteSource,
      quoteAt,
      currentValue: positionValue ? positionValue.toFixed(2) : null,
      profitLoss: pnl,
      returnPct,
    };
  });

  const totalProfit = currentValue.sub(invested);
  return {
    positions,
    totals: {
      invested: invested.toFixed(2),
      currentValue: currentValue.toFixed(2),
      profitLoss: totalProfit.toFixed(2),
      returnPct: invested.isZero() ? "0.00" : totalProfit.div(invested).mul(100).toFixed(2),
      pricedPositions: priced,
      unpricedPositions: unpriced,
    },
  };
}
