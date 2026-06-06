/**
 * Netlify Function (serverless, SEM banco de dados) — proxy de cotação.
 *
 * O site roda 100% no navegador, mas APIs de bolsa bloqueiam CORS. Esta função
 * roda no servidor (onde CORS não se aplica), busca a cotação e devolve em JSON.
 * Não guarda nada — é só um "buscador" sem estado. URL: /.netlify/functions/quote?ticker=PETR4
 *
 * Usa apenas `fetch` global (Node 20+ na Netlify), sem dependências.
 */

const B3 = /^[A-Z]{4}\d{1,2}$/;
const yahooSymbol = (t: string) => (B3.test(t) ? `${t}.SA` : t);

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "content-type": "application/json; charset=utf-8",
  "cache-control": "public, max-age=60",
};

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("", { headers: CORS });

  const ticker = (new URL(req.url).searchParams.get("ticker") || "").trim().toUpperCase();
  if (!ticker) {
    return new Response(JSON.stringify({ error: "Parâmetro 'ticker' obrigatório" }), { status: 400, headers: CORS });
  }

  const tried: string[] = [];

  // 1) Yahoo Finance (server-side, sem CORS). B3 vira TICKER.SA.
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(ticker))}?interval=1d&range=1d`;
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" } });
    if (r.ok) {
      const j: any = await r.json();
      const meta = j?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (price != null && !Number.isNaN(Number(price))) {
        return new Response(JSON.stringify({ ticker, price, currency: meta?.currency ?? "BRL", source: "yahoo", at: new Date().toISOString() }), { headers: CORS });
      }
    }
    tried.push(`yahoo HTTP ${r.status}`);
  } catch (e) {
    tried.push(`yahoo ${(e as Error).message}`);
  }

  // 2) brapi.dev com token (opcional, via env BRAPI_TOKEN nas vars da Netlify).
  const token = process.env.BRAPI_TOKEN;
  if (token) {
    try {
      const r = await fetch(`https://brapi.dev/api/quote/${encodeURIComponent(ticker)}?token=${encodeURIComponent(token)}`);
      if (r.ok) {
        const j: any = await r.json();
        const price = j?.results?.[0]?.regularMarketPrice;
        if (price != null && !Number.isNaN(Number(price))) {
          return new Response(JSON.stringify({ ticker, price, currency: "BRL", source: "brapi", at: new Date().toISOString() }), { headers: CORS });
        }
      }
      tried.push(`brapi HTTP ${r.status}`);
    } catch (e) {
      tried.push(`brapi ${(e as Error).message}`);
    }
  }

  return new Response(
    JSON.stringify({ error: `Cotação de ${ticker} indisponível`, tried }),
    { status: 502, headers: CORS }
  );
};
