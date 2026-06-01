import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, pct, signColor } from "../lib/format";
import { Banner, Button, Card, Input, ReliabilityBadge, ScorePill, Stat, Table } from "../components/ui";

interface Reliability {
  level: "A" | "B" | "C";
  label: string;
  reason: string;
  ageMinutes: number | null;
  allowProfit: boolean;
}
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
  quoteProvider: string | null;
  currentValue: string | null;
  profitLoss: string | null;
  returnPct: string | null;
  reliability: Reliability;
  score: { score: number };
}
interface Portfolio {
  positions: Position[];
  totals: {
    invested: string;
    officialValue: string;
    estimatedValue: string;
    difference: string;
    profitLoss: string;
    returnPct: string;
    countA: number; countB: number; countC: number;
    blockedCount: number;
    blockedImpact: string;
  };
}

const EMPTY = { company: "", ticker: "", quantity: "", avgPrice: "", broker: "", purchaseDate: "" };
const EMPTY_APORTE = { ticker: "", company: "", quantity: "", unitPrice: "", date: "", note: "" };

/** Requirement #11: confer the quote manually on external sites. */
function verifyLinks(ticker: string) {
  return [
    { label: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(ticker + " cotação")}` },
    { label: "Yahoo", url: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}.SA` },
    { label: "Brapi", url: `https://brapi.dev/quote/${encodeURIComponent(ticker)}` },
  ];
}

export function Stocks() {
  const { data, error, loading, reload } = useFetch<Portfolio>(() => api.get("/stocks"));
  const [form, setForm] = useState(EMPTY);
  const [aporte, setAporte] = useState(EMPTY_APORTE);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [aporteMsg, setAporteMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

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
  async function submitAporte(e: React.FormEvent) {
    e.preventDefault();
    setAporteMsg(null);
    try {
      await api.post("/stocks/aporte", { ...aporte, quantity: aporte.quantity || "0", unitPrice: aporte.unitPrice || "0" });
      setAporteMsg({ kind: "success", text: `Aporte em ${aporte.ticker.toUpperCase()} registrado — preço médio recalculado.` });
      setAporte(EMPTY_APORTE);
      await reload();
    } catch (err) {
      setAporteMsg({ kind: "error", text: (err as Error).message });
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
          <Stat label="Valor oficial (A+B)" value={brl(data.totals.officialValue)} sub={`${data.totals.countA} A · ${data.totals.countB} B · ${data.totals.countC} C`} />
          <Stat label="Lucro/Prejuízo (só nível A)" value={brl(data.totals.profitLoss)} accent={signColor(data.totals.profitLoss)} />
          <Stat label="Rentabilidade (só nível A)" value={pct(data.totals.returnPct)} accent={signColor(data.totals.returnPct)} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Cadastrar ação">
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Empresa" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} required />
            <Input placeholder="Ticker" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} required />
            <Input type="number" step="0.00000001" placeholder="Qtd" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
            <Input type="number" step="0.00000001" placeholder="Preço médio" value={form.avgPrice} onChange={(e) => setForm({ ...form, avgPrice: e.target.value })} required />
            <Input placeholder="Corretora" value={form.broker} onChange={(e) => setForm({ ...form, broker: e.target.value })} />
            <Input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} />
            <div className="md:col-span-2"><Button type="submit" className="w-full">Adicionar</Button></div>
          </form>
          {submitError && <div className="mt-2"><Banner kind="error">{submitError}</Banner></div>}
        </Card>

        <Card title="Aporte (integra à carteira)">
          <p className="mb-3 text-sm text-slate-400">Adiciona quantidade a um ativo recalculando o preço médio ponderado. Se o ativo não existir, é criado.</p>
          <form onSubmit={submitAporte} className="grid gap-3 md:grid-cols-2">
            <Input placeholder="Ticker do ativo" value={aporte.ticker} onChange={(e) => setAporte({ ...aporte, ticker: e.target.value })} required />
            <Input placeholder="Empresa (opcional)" value={aporte.company} onChange={(e) => setAporte({ ...aporte, company: e.target.value })} />
            <Input type="number" step="0.00000001" placeholder="Quantidade" value={aporte.quantity} onChange={(e) => setAporte({ ...aporte, quantity: e.target.value })} required />
            <Input type="number" step="0.00000001" placeholder="Valor (preço unitário)" value={aporte.unitPrice} onChange={(e) => setAporte({ ...aporte, unitPrice: e.target.value })} required />
            <Input type="date" value={aporte.date} onChange={(e) => setAporte({ ...aporte, date: e.target.value })} />
            <Input placeholder="Observação" value={aporte.note} onChange={(e) => setAporte({ ...aporte, note: e.target.value })} />
            <div className="md:col-span-2"><Button type="submit" className="w-full">Registrar aporte</Button></div>
          </form>
          {aporteMsg && <div className="mt-2"><Banner kind={aporteMsg.kind}>{aporteMsg.text}</Banner></div>}
        </Card>
      </div>

      <Card title="Carteira">
        {loading && <p className="text-slate-400">Carregando…</p>}
        {error && <Banner kind="error">{error}</Banner>}
        {data && (
          <>
            {data.totals.blockedCount > 0 && (
              <div className="mb-3">
                <Banner kind="warn">
                  {data.totals.blockedCount} ativo(s) em nível C (cotação não confiável) — L/P e rentabilidade bloqueados.
                  Atualize na aba <strong>Cotações</strong>.
                </Banner>
              </div>
            )}
            <Table headers={["Conf.", "Score", "Ticker", "Qtd", "Preço médio", "Atual", "Investido", "Valor atual", "L/P", "Rent.", "Verificar", ""]}>
              {data.positions.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/50">
                  <td className="px-2 py-2"><ReliabilityBadge level={p.reliability.level} /></td>
                  <td className="px-2 py-2"><ScorePill score={p.score.score} /></td>
                  <td className="px-2 py-2 font-semibold">{p.ticker}<div className="text-[10px] font-normal text-slate-500">{p.company}</div></td>
                  <td className="px-2 py-2">{Number(p.quantity)}</td>
                  <td className="px-2 py-2">{brl(p.avgPrice)}</td>
                  <td className="px-2 py-2">
                    {p.currentPrice ? brl(p.currentPrice) : <span className="text-rose-400">sem cotação</span>}
                    {p.reliability.level !== "A" && p.currentPrice && (
                      <div className="text-[10px] text-amber-400">{p.reliability.label}</div>
                    )}
                  </td>
                  <td className="px-2 py-2">{brl(p.invested)}</td>
                  <td className="px-2 py-2">{p.currentValue ? brl(p.currentValue) : "—"}</td>
                  <td className={`px-2 py-2 ${signColor(p.profitLoss)}`}>
                    {p.profitLoss ? brl(p.profitLoss) : <span className="text-slate-500" title={p.reliability.reason}>bloqueado</span>}
                  </td>
                  <td className={`px-2 py-2 ${signColor(p.returnPct)}`}>{p.returnPct ? pct(p.returnPct) : <span className="text-slate-500">—</span>}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      {verifyLinks(p.ticker).map((l) => (
                        <a key={l.label} href={l.url} target="_blank" rel="noreferrer" className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-sky-300 hover:bg-slate-700">{l.label}</a>
                      ))}
                    </div>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => remove(p.id)} className="text-xs text-rose-400 hover:underline">excluir</button>
                  </td>
                </tr>
              ))}
              {data.positions.length === 0 && (
                <tr><td colSpan={12} className="px-2 py-4 text-center text-slate-500">Nenhuma ação cadastrada.</td></tr>
              )}
            </Table>
          </>
        )}
      </Card>
    </div>
  );
}
