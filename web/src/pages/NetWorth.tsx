import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, dateBR } from "../lib/format";
import { Banner, BarChart, Button, Card, Input, Stat, Table } from "../components/ui";

interface Asset { id: string; name: string; type: string; official_value: string; estimated_value: string; as_of: string }
interface NetWorthData {
  official: string;
  estimated: string;
  cash: string;
  stocksInvested: string;
  stocksMarket: string;
  assets: Asset[];
  distribution: { label: string; value: string }[];
}

const EMPTY = { name: "", type: "outros", officialValue: "", estimatedValue: "", asOf: "" };

export function NetWorth() {
  const { data, error, loading, reload } = useFetch<NetWorthData>(() => api.get("/networth"));
  const [form, setForm] = useState(EMPTY);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await api.post("/networth/assets", { ...form, officialValue: form.officialValue || "0", estimatedValue: form.estimatedValue || form.officialValue || "0" });
      setForm(EMPTY);
      await reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }
  async function remove(id: string) {
    await api.del(`/networth/assets/${id}`);
    await reload();
  }

  return (
    <div className="space-y-4">
      {data && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Patrimônio oficial" value={brl(data.official)} sub="caixa + ativos oficiais + ações (custo)" />
          <Stat label="Patrimônio estimado" value={brl(data.estimated)} sub="ações a mercado" />
          <Stat label="Caixa" value={brl(data.cash)} />
          <Stat label="Ações (mercado)" value={brl(data.stocksMarket)} />
        </div>
      )}

      {data && (
        <Card title="Distribuição dos ativos">
          <BarChart data={data.distribution.map((d) => ({ label: d.label, value: Number(d.value) }))} />
        </Card>
      )}

      <Card title="Cadastrar ativo">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
          <Input placeholder="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input placeholder="Tipo (imóvel, veículo…)" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
          <Input type="number" step="0.01" placeholder="Valor oficial" value={form.officialValue} onChange={(e) => setForm({ ...form, officialValue: e.target.value })} required />
          <Input type="number" step="0.01" placeholder="Valor estimado" value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} />
          <Input type="date" value={form.asOf} onChange={(e) => setForm({ ...form, asOf: e.target.value })} />
          <Button type="submit">Adicionar</Button>
        </form>
        {submitError && <div className="mt-2"><Banner kind="error">{submitError}</Banner></div>}
      </Card>

      <Card title="Ativos">
        {loading && <p className="text-slate-400">Carregando…</p>}
        {error && <Banner kind="error">{error}</Banner>}
        {data && (
          <Table headers={["Nome", "Tipo", "Oficial", "Estimado", "Data", ""]}>
            {data.assets.map((a) => (
              <tr key={a.id} className="border-b border-slate-800/50">
                <td className="px-2 py-2">{a.name}</td>
                <td className="px-2 py-2 capitalize text-slate-300">{a.type}</td>
                <td className="px-2 py-2">{brl(a.official_value)}</td>
                <td className="px-2 py-2">{brl(a.estimated_value)}</td>
                <td className="px-2 py-2 text-slate-400">{dateBR(a.as_of)}</td>
                <td className="px-2 py-2 text-right"><button onClick={() => remove(a.id)} className="text-xs text-rose-400 hover:underline">excluir</button></td>
              </tr>
            ))}
            {data.assets.length === 0 && <tr><td colSpan={6} className="px-2 py-4 text-center text-slate-500">Nenhum ativo. Apenas caixa e ações compõem o patrimônio.</td></tr>}
          </Table>
        )}
      </Card>
    </div>
  );
}
