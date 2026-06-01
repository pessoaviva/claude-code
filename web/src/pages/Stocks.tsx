import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, dateBR, pct, signColor } from "../lib/format";
import { Banner, Button, Card, Input, Stat, Table } from "../components/ui";

interface Position {
  id: string;
  company: string;
  ticker: string;
  quantity: string;
  avgPrice: string;
  broker: string;
  purchaseDate: string;
  invested: string;
  currentPrice: string | null;
  quoteSource: "auto" | "manual" | null;
  currentValue: string | null;
  profitLoss: string | null;
  returnPct: string | null;
}
interface Portfolio {
  positions: Position[];
  totals: {
    invested: string;
    currentValue: string;
    profitLoss: string;
    returnPct: string;
    pricedPositions: number;
    unpricedPositions: number;
  };
}

const EMPTY = { company: "", ticker: "", quantity: "", avgPrice: "", broker: "", purchaseDate: "" };

export function Stocks() {
  const { data, error, loading, reload } = useFetch<Portfolio>(() => api.get("/stocks"));
  const [form, setForm] = useState(EMPTY);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await api.post("/stocks", { ...form, quantity: form.quantity || "0", avgPrice: form.avgPrice || "0" });
      setForm(EMPTY);
      await reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }
  async function remove(id: string) {
    await api.del(`/stocks/${id}`);
    await reload();
  }

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Valor investido" value={brl(data.totals.invested)} />
          <Stat label="Valor atual" value={brl(data.totals.currentValue)} />
          <Stat label="Lucro / Prejuízo" value={brl(data.totals.profitLoss)} accent={signColor(data.totals.profitLoss)} />
          <Stat label="Rentabilidade" value={pct(data.totals.returnPct)} accent={signColor(data.totals.returnPct)} />
        </div>
      )}

      <Card title="Cadastrar ação">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-7">
          <Input placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
          <Input placeholder="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} required />
          <Input type="number" step="0.00000001" placeholder="Qtd" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          <Input type="number" step="0.00000001" placeholder="Preço médio" value={form.avgPrice} onChange={(e) => setForm({ ...form, avgPrice: e.target.value })} required />
          <Input placeholder="Corretora" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} />
          <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
          <Button type="submit">Adicionar</Button>
        </form>
        {submitError && <div className="mt-2"><Banner kind="error">{submitError}</Banner></div>}
      </Card>

      <Card title="Carteira">
        {loading && <p className="text-slate-400">Carregando…</p>}
        {error && <Banner kind="error">{error}</Banner>}
        {data && (
          <>
            {data.totals.unpricedPositions > 0 && (
              <div className="mb-3">
                <Banner kind="warn">
                  {data.totals.unpricedPositions} ação(ões) sem cotação. Atualize na aba <strong>Cotações</strong>.
                </Banner>
              </div>
            )}
            <Table headers={["Ticker", "Empresa", "Qtd", "Preço médio", "Atual", "Investido", "Valor atual", "L/P", "Rent.", "Fonte", ""]}>
              {data.positions.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50">
                  <td className="px-2 py-2 font-semibold">{p.ticker}</td>
                  <td className="px-2 py-2 text-slate-300">{p.company}</td>
                  <td className="px-2 py-2">{Number(p.quantity)}</td>
                  <td className="px-2 py-2">{brl(p.avgPrice)}</td>
                  <td className="px-2 py-2">{p.currentPrice ? brl(p.currentPrice) : <span className="text-amber-400">sem cotação</span>}</td>
                  <td className="px-2 py-2">{brl(p.invested)}</td>
                  <td className="px-2 py-2">{p.currentValue ? brl(p.currentValue) : "—"}</td>
                  <td className={`px-2 py-2 ${signColor(p.profitLoss)}`}>{p.profitLoss ? brl(p.profitLoss) : "—"}</td>
                  <td className={`px-2 py-2 ${signColor(p.returnPct)}`}>{p.returnPct ? pct(p.returnPct) : "—"}</td>
                  <td className="px-2 py-2 text-xs text-slate-400">{p.quoteSource ?? "—"}</td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => remove(p.id)} className="text-xs text-rose-400 hover:underline">excluir</button>
                  </td>
                </tr>
              ))}
              {data.positions.length === 0 && (
                <tr><td colSpan={11} className="px-2 py-4 text-center text-slate-500">Nenhuma ação cadastrada. Compra em {dateBR(new Date().toISOString())}.</td></tr>
              )}
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
