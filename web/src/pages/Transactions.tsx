import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, dateBR } from "../lib/format";
import { Banner, Button, Card, Input, Select, Table } from "../components/ui";

interface Tx {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: string;
}

export function Transactions({
  endpoint,
  categories,
  title,
  accent,
}: {
  endpoint: string;
  categories: { value: string; label: string }[];
  title: string;
  accent: string;
}) {
  const { data, error, loading, reload } = useFetch<Tx[]>(() => api.get(endpoint), [endpoint]);
  const [form, setForm] = useState({ category: categories[0].value, description: "", amount: "", date: "" });
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await api.post(endpoint, { ...form, amount: form.amount || "0" });
      setForm({ category: categories[0].value, description: "", amount: "", date: "" });
      await reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }

  async function remove(id: string) {
    await api.del(`${endpoint}/${id}`);
    await reload();
  }

  const total = (data ?? []).reduce((s, t) => s + Number(t.amount), 0);

  return (
    <div className="space-y-4">
      <Card title={`Novo lançamento — ${title}`}>
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-5">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Input placeholder="Descrição" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input type="number" step="0.01" min="0" placeholder="Valor" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
          <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Button type="submit">Adicionar</Button>
        </form>
        {submitError && <div className="mt-2"><Banner kind="error">{submitError}</Banner></div>}
      </Card>

      <Card title={`Histórico — Total: ${brl(total)}`}>
        {loading && <p className="text-slate-400">Carregando…</p>}
        {error && <Banner kind="error">{error}</Banner>}
        {data && (
          <Table headers={["Data", "Categoria", "Descrição", "Valor", ""]}>
            {data.map((t) => (
              <tr key={t.id} className="border-b border-slate-800/50">
                <td className="px-2 py-2">{dateBR(t.date)}</td>
                <td className="px-2 py-2 capitalize">{t.category.replace(/_/g, " ")}</td>
                <td className="px-2 py-2 text-slate-300">{t.description || "—"}</td>
                <td className={`px-2 py-2 font-medium ${accent}`}>{brl(t.amount)}</td>
                <td className="px-2 py-2 text-right">
                  <button onClick={() => remove(t.id)} className="text-xs text-rose-400 hover:underline">excluir</button>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-4 text-center text-slate-500">Nenhum lançamento.</td></tr>
            )}
          </Table>
        )}
      </Card>
    </div>
  );
}

export const INCOME_CATEGORIES = [
  { value: "salario", label: "Salário" },
  { value: "mesada", label: "Mesada" },
  { value: "vendas", label: "Vendas" },
  { value: "dividendos", label: "Dividendos" },
  { value: "rendimentos", label: "Rendimentos" },
  { value: "outros", label: "Outros" },
];

export const EXPENSE_CATEGORIES = [
  { value: "assinaturas", label: "Assinaturas" },
  { value: "saidas_casa", label: "Saídas de casa" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "transporte", label: "Transporte" },
  { value: "saude", label: "Saúde" },
  { value: "educacao", label: "Educação" },
  { value: "lazer", label: "Lazer" },
  { value: "outros", label: "Outros" },
];
