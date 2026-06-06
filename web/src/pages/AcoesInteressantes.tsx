import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, dateBR, pct, signColor } from "../lib/format";
import { Banner, Button, Card, Input, Stat, Table } from "../components/ui";

interface Item {
  id: string;
  company: string;
  ticker: string;
  quantity: string;
  buyPrice: string;
  currentPrice: string;
  priceUpdatedAt: string;
  invested: string;
  currentValue: string;
  profitLoss: string;
  returnPct: string | null;
}
interface WatchlistData {
  refDate: string;
  items: Item[];
  totals: { invested: string; currentValue: string; profitLoss: string; returnPct: string };
}

const EMPTY_ADD = { company: "", ticker: "", quantity: "", buyPrice: "", currentPrice: "" };

// Live (client-side) recompute for instant feedback while editing.
function calc(it: Item) {
  const qty = Number(it.quantity) || 0;
  const buy = Number(it.buyPrice) || 0;
  const cur = Number(it.currentPrice) || 0;
  const invested = qty * buy;
  const current = qty * cur;
  const pl = current - invested;
  const ret = invested > 0 ? (pl / invested) * 100 : null;
  return { invested, current, pl, ret };
}

export function AcoesInteressantes() {
  const { data, error, loading, reload } = useFetch<WatchlistData>(() => api.get("/watchlist"));
  const [rows, setRows] = useState<Item[]>([]);
  const [add, setAdd] = useState(EMPTY_ADD);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (data) setRows(data.items);
  }, [data]);

  function setField(id: string, field: "quantity" | "buyPrice" | "currentPrice", value: string) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  async function persist(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    try {
      const updated = await api.patch<Item>(`/watchlist/${id}`, { quantity: row.quantity || "0", buyPrice: row.buyPrice || "0", currentPrice: row.currentPrice || "0" });
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function addStock(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await api.post("/watchlist", { ...add, quantity: add.quantity || "0", buyPrice: add.buyPrice || "0", currentPrice: add.currentPrice || "0" });
      setAdd(EMPTY_ADD);
      await reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  async function remove(id: string) {
    await api.del(`/watchlist/${id}`);
    await reload();
  }

  // Totals from the live editable state.
  const totals = rows.reduce(
    (acc, r) => {
      const c = calc(r);
      acc.invested += c.invested;
      acc.current += c.current;
      return acc;
    },
    { invested: 0, current: 0 }
  );
  const totalPL = totals.current - totals.invested;
  const totalRet = totals.invested > 0 ? (totalPL / totals.invested) * 100 : null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Total investido" value={brl(totals.invested)} />
        <Stat label="Valor atual" value={brl(totals.current)} />
        <Stat label="Lucro / Prejuízo" value={brl(totalPL)} accent={signColor(totalPL)} />
        <Stat label="Rentabilidade" value={totalRet == null ? "—" : pct(totalRet)} accent={signColor(totalRet ?? 0)} />
      </div>

      <Banner kind="info">
        Preços atuais são uma <strong>referência</strong> de {data ? dateBR(data.refDate) : "—"} — edite-os à vontade
        (no modo navegador não há busca automática). Preencha a <strong>quantidade</strong> e o <strong>preço pago</strong>
        das ações que você comprou para ver o lucro/prejuízo.
      </Banner>

      {msg && <Banner kind="error">{msg}</Banner>}

      <Card title="Adicionar ação à lista">
        <form onSubmit={addStock} className="grid gap-3 md:grid-cols-6">
          <Input placeholder="Empresa" value={add.company} onChange={(e) => setAdd({ ...add, company: e.target.value })} required />
          <Input placeholder="Ticker (ex: VALE3)" value={add.ticker} onChange={(e) => setAdd({ ...add, ticker: e.target.value })} required />
          <Input type="number" step="0.00000001" min="0" placeholder="Qtd" value={add.quantity} onChange={(e) => setAdd({ ...add, quantity: e.target.value })} />
          <Input type="number" step="0.01" min="0" placeholder="Preço pago" value={add.buyPrice} onChange={(e) => setAdd({ ...add, buyPrice: e.target.value })} />
          <Input type="number" step="0.01" min="0" placeholder="Preço atual" value={add.currentPrice} onChange={(e) => setAdd({ ...add, currentPrice: e.target.value })} />
          <Button type="submit">Adicionar</Button>
        </form>
      </Card>

      <Card title="Ações interessantes">
        {loading && <p className="text-slate-400">Carregando…</p>}
        {error && <Banner kind="error">{error}</Banner>}
        {!loading && (
          <Table headers={["Ticker", "Empresa", "Qtd", "Preço pago", "Preço atual", "Investido", "Valor atual", "Lucro/Prejuízo", "Rent.", ""]}>
            {rows.map((r) => {
              const c = calc(r);
              return (
                <tr key={r.id} className="border-b border-slate-800/50">
                  <td className="px-2 py-2 font-semibold">{r.ticker}</td>
                  <td className="px-2 py-2 text-slate-300">{r.company}</td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.00000001" min="0" value={r.quantity}
                      onChange={(e) => setField(r.id, "quantity", e.target.value)} onBlur={() => persist(r.id)}
                      className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.01" min="0" value={r.buyPrice}
                      onChange={(e) => setField(r.id, "buyPrice", e.target.value)} onBlur={() => persist(r.id)}
                      className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" />
                  </td>
                  <td className="px-2 py-2">
                    <input type="number" step="0.01" min="0" value={r.currentPrice}
                      onChange={(e) => setField(r.id, "currentPrice", e.target.value)} onBlur={() => persist(r.id)}
                      className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-sm" />
                  </td>
                  <td className="px-2 py-2">{brl(c.invested)}</td>
                  <td className="px-2 py-2">{brl(c.current)}</td>
                  <td className={`px-2 py-2 font-medium ${signColor(c.pl)}`}>{c.invested > 0 ? brl(c.pl) : "—"}</td>
                  <td className={`px-2 py-2 ${signColor(c.ret ?? 0)}`}>{c.ret == null ? "—" : pct(c.ret)}</td>
                  <td className="px-2 py-2 text-right">
                    <button onClick={() => remove(r.id)} className="text-xs text-rose-400 hover:underline">remover</button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr><td colSpan={10} className="px-2 py-4 text-center text-slate-500">Nenhuma ação na lista.</td></tr>
            )}
          </Table>
        )}
      </Card>
    </div>
  );
}
