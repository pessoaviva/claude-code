import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, dateBR } from "../lib/format";
import { Banner, Button, Card, Input, Select } from "../components/ui";

interface Goal { id: string; type: string; name: string; target: string; current: string; deadline: string | null; progressPct: string }

const TYPES = [
  { value: "patrimonio", label: "Patrimônio" },
  { value: "investimentos", label: "Investimentos" },
  { value: "economia", label: "Economia" },
  { value: "renda_passiva", label: "Renda passiva" },
];
const EMPTY = { type: "patrimonio", name: "", target: "", current: "", deadline: "" };

export function Goals() {
  const { data, error, loading, reload } = useFetch<Goal[]>(() => api.get("/goals"));
  const [form, setForm] = useState(EMPTY);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    try {
      await api.post("/goals", { ...form, target: form.target || "0", current: form.current || "0", deadline: form.deadline || null });
      setForm(EMPTY);
      await reload();
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }
  async function updateCurrent(id: string, current: string) {
    await api.patch(`/goals/${id}`, { current });
    await reload();
  }
  async function remove(id: string) {
    await api.del(`/goals/${id}`);
    await reload();
  }

  return (
    <div className="space-y-4">
      <Card title="Nova meta">
        <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
          <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </Select>
          <Input placeholder="Nome da meta" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <Input type="number" step="0.01" placeholder="Alvo" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} required />
          <Input type="number" step="0.01" placeholder="Atual" value={form.current} onChange={(e) => setForm({ ...form, current: e.target.value })} />
          <Input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
          <Button type="submit">Criar</Button>
        </form>
        {submitError && <div className="mt-2"><Banner kind="error">{submitError}</Banner></div>}
      </Card>

      {loading && <p className="text-slate-400">Carregando…</p>}
      {error && <Banner kind="error">{error}</Banner>}
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((g) => {
          const progress = Math.min(100, Number(g.progressPct));
          return (
            <Card key={g.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wide text-indigo-400">{TYPES.find((t) => t.value === g.type)?.label}</div>
                  <div className="text-lg font-semibold">{g.name}</div>
                </div>
                <button onClick={() => remove(g.id)} className="text-xs text-rose-400 hover:underline">excluir</button>
              </div>
              <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-indigo-500" style={{ width: `${progress}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-slate-400">{brl(g.current)} / {brl(g.target)}</span>
                <span className="font-medium">{g.progressPct}%</span>
              </div>
              {g.deadline && <div className="mt-1 text-xs text-slate-500">Prazo: {dateBR(g.deadline)}</div>}
              <div className="mt-3 flex gap-2">
                <Input type="number" step="0.01" placeholder="Atualizar valor atual" id={`g-${g.id}`} />
                <Button onClick={() => { const el = document.getElementById(`g-${g.id}`) as HTMLInputElement; if (el?.value) updateCurrent(g.id, el.value); }}>Atualizar</Button>
              </div>
            </Card>
          );
        })}
      </div>
      {data && data.length === 0 && <p className="text-center text-slate-500">Nenhuma meta cadastrada.</p>}
    </div>
  );
}
