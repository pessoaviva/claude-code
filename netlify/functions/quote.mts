/**
 * Netlify Function (serverless, SEM banco) — proxy de cotação.
 *
 * Por que existe: o site roda no navegador e APIs de bolsa bloqueiam CORS.
 * Esta função roda no servidor (sem CORS) e busca o preço. Não guarda estado.
 *
 * IMPORTANTE (lição do que falhou antes): o Yahoo bloqueia IPs de datacenter
 * (Lambda) com 401/429. Por isso a fonte primária agora é o **Google Finance**
 * (raspagem do `data-last-price`), que funciona de servidor e cobre a B3
 * (sufixo :BVMF). brapi (com token) e Yahoo entram como reserva.
 *
 * Uso:
 *   /.netlify/functions/quote?ticker=PETR4          -> { ticker, price, source }
 *   /.netlify/functions/quote?tickers=PETR4,ITUB4   -> { results: [...] }
 */

const B3 = /^[A-Z]{4}\d{1,2}$/;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: CORS });

async function timed(url: string, init: RequestInit = {}, ms = 6000): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

// --- fontes (cada uma retorna número ou null; lança em erro de rede/HTTP) ---

async function fromGoogle(ticker: string): Promise<number | null> {
  const sym = B3.test(ticker) ? `${ticker}:BVMF` : ticker;
  const r = await timed(`https://www.google.com/finance/quote/${encodeURIComponent(sym)}?hl=en`, {
    headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  // `data-last-price` é um número limpo (ex.: 42.83), independente de locale.
  const m = html.match(/data-last-price="([0-9]+(?:\.[0-9]+)?)"/);
  if (m) return Number(m[1]);
  // Reserva: div de preço visível.
  const m2 = html.match(/class="YMlKec fxKbKc">[^0-9-]*([0-9][0-9.,]*)/);
  if (m2) return Number(m2[1].replace(/,/g, ""));
  return null;
}

async function fromBrapi(ticker: string): Promise<number | null> {
  const token = process.env.BRAPI_TOKEN;
  if (!token) return null;
  const r = await timed(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${encodeURIComponent(token)}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();
  const p = j?.results?.[0]?.regularMarketPrice;
  return p != null && !Number.isNaN(Number(p)) ? Number(p) : null;
}

async function fromYahoo(ticker: string): Promise<number | null> {
  const sym = B3.test(ticker) ? `${ticker}.SA` : ticker;
  const r = await timed(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();
  const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
  return p != null && !Number.isNaN(Number(p)) ? Number(p) : null;
}

interface Quote { ticker: string; price: number; source: string; }

async function resolveOne(rawTicker: string): Promise<Quote> {
  const ticker = rawTicker.trim().toUpperCase();
  const tried: string[] = [];
  // Ordem: brapi (se token) -> Google -> Yahoo.
  const sources: [string, () => Promise<number | null>][] = [];
  if (process.env.BRAPI_TOKEN) sources.push(["brapi", () => fromBrapi(ticker)]);
  sources.push(["google", () => fromGoogle(ticker)]);
  sources.push(["yahoo", () => fromYahoo(ticker)]);

  for (const [name, fn] of sources) {
    try {
      const price = await fn();
      if (price != null && price > 0) return { ticker, price, source: name };
      tried.push(`${name}: sem preço`);
    } catch (e) {
      tried.push(`${name}: ${(e as Error).message}`);
    }
  }
  throw new Error(tried.join(" | "));
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });
  const params = new URL(req.url).searchParams;

  // Lote: ?tickers=PETR4,ITUB4,...  (1 chamada para "Atualizar todas")
  const bulk = params.get("tickers");
  if (bulk) {
    const list = bulk.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30);
    const settled = await Promise.allSettled(list.map(resolveOne));
    const results = settled.map((s, i) =>
      s.status === "fulfilled" ? s.value : { ticker: list[i].toUpperCase(), error: (s.reason as Error).message }
    );
    return json({ results });
  }

  // Único: ?ticker=PETR4
  const ticker = (params.get("ticker") || "").trim();
  if (!ticker) return json({ error: "Parâmetro 'ticker' ou 'tickers' obrigatório" }, 400);
  try {
    return json(await resolveOne(ticker));
  } catch (e) {
    return json({ error: `Cotação de ${ticker.toUpperCase()} indisponível`, tried: (e as Error).message }, 502);
  }
};
