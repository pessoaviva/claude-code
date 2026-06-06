/**
 * Busca de cotação no modo navegador.
 *
 * Como o app roda 100% no browser, as APIs de bolsa esbarram em CORS. Estratégia
 * com fallback, da mais confiável para a menos:
 *   1) brapi.dev COM token (suporta CORS; token grátis em https://brapi.dev) ;
 *   2) Yahoo Finance via proxy CORS público (sem token, best-effort) ;
 * Se tudo falhar, lança erro claro e o usuário edita o preço manualmente.
 *
 * Observação: o ambiente de build não tem acesso de rede para testar ao vivo;
 * a lógica de parsing foi validada com respostas simuladas.
 */

const TOKEN_KEY = "fintrack:brapi_token";

export function getBrapiToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}
export function setBrapiToken(token: string): void {
  try {
    if (token.trim()) localStorage.setItem(TOKEN_KEY, token.trim());
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** Tickers da B3 (ex.: PETR4) viram PETR4.SA no Yahoo. */
function yahooSymbol(ticker: string): string {
  return /^[A-Z]{4}\d{1,2}$/.test(ticker) ? `${ticker}.SA` : ticker;
}

async function fetchJson(url: string, timeoutMs = 9000): Promise<any> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  return JSON.parse(text);
}

export interface FetchedQuote {
  price: string;
  source: string;
}

export async function fetchQuote(ticker: string): Promise<FetchedQuote> {
  const t = ticker.trim().toUpperCase();
  const errors: string[] = [];

  // 1) brapi.dev com token — caminho mais confiável (CORS suportado).
  const token = getBrapiToken();
  if (token) {
    try {
      const j = await fetchJson(`https://brapi.dev/api/quote/${encodeURIComponent(t)}?token=${encodeURIComponent(token)}`);
      const p = j?.results?.[0]?.regularMarketPrice;
      if (p != null && !Number.isNaN(Number(p))) return { price: String(p), source: "brapi" };
      errors.push("brapi sem preço");
    } catch (e) {
      errors.push(`brapi: ${(e as Error).message}`);
    }
  }

  // 2) Yahoo Finance via proxies CORS públicos (sem token).
  const yurl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol(t))}?interval=1d&range=1d`;
  const proxies = [
    (u: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    (u: string) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
  ];
  for (const proxy of proxies) {
    try {
      const j = await fetchJson(proxy(yurl));
      const p = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (p != null && !Number.isNaN(Number(p))) return { price: String(p), source: "yahoo" };
      errors.push("yahoo sem preço");
    } catch (e) {
      errors.push(`proxy: ${(e as Error).message}`);
    }
  }

  throw new Error(
    `Não consegui buscar ${t} online (${errors.slice(0, 2).join("; ") || "bloqueado"}). ` +
      `Configure um token brapi (grátis) ou edite o preço manualmente.`
  );
}
