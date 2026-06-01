import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, dateTimeBR } from "../lib/format";
import { Banner, Button, Card, Input, Table } from "../components/ui";

interface Quote {
  ticker: string;
  price: string;
  source: "auto" | "manual";
  fetched_at: string;
}

export function Quotes() {
  const { data, error, loading, reload } = useFetch<Quote[]>(() => api.get("/quotes"));
  const [manual, setManual] = useState({ ticker: "", price: "" });
  const [autoTicker, setAutoTicker] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success" | "warn"; text: string } | null>(null);

  async function tryAuto(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const ticker = autoTicker.trim().toUpperCase();
    if (!ticker) return;
    try {
      await api.post(`/quotes/auto/${ticker}`);
      setMsg({ kind: "success", text: `Cotação automática de ${ticker} atualizada.` });
      setAutoTicker("");
      await reload();
    } catch (err) {
      // Graceful fallback: prompt for manual entry, prefill the ticker.
      setManual({ ticker, price: "" });
      setMsg({ kind: "warn", text: `${(err as Error).message} (campo manual preenchido abaixo)` });
    }
  }

  async function saveManual(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post("/quotes/manual", { ticker: manual.ticker.toUpperCase(), price: manual.price || "0" });
      setMsg({ kind: "success", text: `Cotação manual de ${manual.ticker.toUpperCase()} registrada. Carteira recalculada.` });
      setManual({ ticker: "", price: "" });
      await reload();
    } catch (err) {
      setMsg({ kind: "error", text: (err as Error).message });
    }
  }

  return (
    <div className="space-y-4">
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Modo automático (API)">
          <p className="mb-3 text-sm text-slate-400">
            Busca o preço atual no provedor configurado. Se a API falhar, o sistema continua funcionando — preencha manualmente.
          </p>
          <form onSubmit={tryAuto} className="flex gap-2">
            <Input placeholder="Ticker (ex: PETR4)" value={autoTicker} onChange={(e) => setAutoTicker(e.target.value)} />
            <Button type="submit">Buscar</Button>
          </form>
        </Card>

        <Card title="Modo manual (fallback)">
          <p className="mb-3 text-sm text-slate-400">Informe o preço atual. Data/hora são registradas e a carteira é recalculada automaticamente.</p>
          <form onSubmit={saveManual} className="flex gap-2">
            <Input placeholder="Ticker" value={manual.ticker} onChange={(e) => setManual({ ...manual, ticker: e.target.value })} required />
            <Input type="number" step="0.00000001" min="0" placeholder="Preço" value={manual.price} onChange={(e) => setManual({ ...manual, price: e.target.value })} required />
            <Button type="submit">Salvar</Button>
          </form>
        </Card>
      </div>

      <Card title="Cotações atuais">
        {loading && <p className="text-slate-400">Carregando…</p>}
        {error && <Banner kind="error">{error}</Banner>}
        {data && (
          <Table headers={["Ticker", "Preço", "Fonte", "Atualizado em"]}>
            {data.map((q) => (
              <tr key={q.ticker} className="border-b border-slate-800/50">
                <td className="px-2 py-2 font-semibold">{q.ticker}</td>
                <td className="px-2 py-2">{brl(q.price)}</td>
                <td className="px-2 py-2">
                  <span className={`rounded px-2 py-0.5 text-xs ${q.source === "auto" ? "bg-sky-900 text-sky-200" : "bg-amber-900 text-amber-200"}`}>
                    {q.source}
                  </span>
                </td>
                <td className="px-2 py-2 text-slate-400">{dateTimeBR(q.fetched_at)}</td>
              </tr>
            ))}
            {data.length === 0 && <tr><td colSpan={4} className="px-2 py-4 text-center text-slate-500">Nenhuma cotação registrada.</td></tr>}
          </Table>
        )}
      </Card>
    </div>
  );
}
