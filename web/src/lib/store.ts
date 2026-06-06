/**
 * Browser-only persistence. All FinTrack data lives in localStorage under a
 * single key — no backend, no database. Data is per-browser/device.
 */
export interface Row {
  id: string;
  [key: string]: unknown;
}

export interface DB {
  income: Row[];
  expenses: Row[];
  stocks: Row[];
  quotes: Row[];
  quote_attempts: Row[];
  stock_contributions: Row[];
  assets: Row[];
  products: Row[];
  purchases: Row[];
  sales: Row[];
  goals: Row[];
  audit_log: Row[];
  watchlist: Row[];
  _seq: Record<string, number>;
}

const KEY = "fintrack:v1";

function empty(): DB {
  return {
    income: [], expenses: [], stocks: [], quotes: [], quote_attempts: [],
    stock_contributions: [], assets: [], products: [], purchases: [], sales: [],
    goals: [], audit_log: [], watchlist: [], _seq: {},
  };
}

let cache: DB | null = null;

export function load(): DB {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...empty(), ...(JSON.parse(raw) as Partial<DB>) } as DB : empty();
  } catch {
    cache = empty();
  }
  return cache;
}

export function save(): void {
  if (cache) localStorage.setItem(KEY, JSON.stringify(cache));
}

export function nextId(table: keyof DB): string {
  const db = load();
  db._seq[table] = (db._seq[table] ?? 0) + 1;
  return String(db._seq[table]);
}

/** Wipe all data (used by the "limpar dados" action). */
export function resetAll(): void {
  cache = empty();
  save();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
