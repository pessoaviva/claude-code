import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { brl, pct, signColor } from "../lib/format";
import { Banner, BarChart, Card, Stat } from "../components/ui";

interface DashboardData {
  balance: string;
  netWorth: string;
  income: string;
  expenses: string;
  investments: string;
  investmentsMarket: string;
  dividends: string;
  portfolioReturnPct: string;
  unpricedPositions: number;
  reliability: { countA: number; countB: number; countC: number; blockedCount: number };
  charts: {
    incomeByMonth: { month: string; total: string }[];
    expenseByMonth: { month: string; total: string }[];
    expenseByCategory: { category: string; total: string }[];
  };
}

export function Dashboard() {
  const { data, error, loading } = useFetch<DashboardData>(() => api.get("/dashboard"));

  if (loading) return <div className="text-slate-400">Carregando…</div>;
  if (error) return <Banner kind="error">Erro ao carregar dashboard: {error}</Banner>;
  if (!data) return null;

  const months = data.charts.incomeByMonth.map((m) => m.month);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Saldo atual" value={brl(data.balance)} accent={signColor(data.balance)} />
        <Stat label="Patrimônio" value={brl(data.netWorth)} />
        <Stat label="Ganhos" value={brl(data.income)} accent="text-emerald-400" />
        <Stat label="Gastos" value={brl(data.expenses)} accent="text-rose-400" />
        <Stat label="Investido" value={brl(data.investments)} />
        <Stat label="Investimentos (mercado)" value={brl(data.investmentsMarket)} />
        <Stat label="Dividendos" value={brl(data.dividends)} accent="text-emerald-400" />
        <Stat label="Rentabilidade carteira" value={pct(data.portfolioReturnPct)} accent={signColor(data.portfolioReturnPct)} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-slate-400">Saúde da carteira:</span>
        <span className="rounded border border-emerald-700 bg-emerald-900/50 px-2 py-0.5 text-emerald-200">{data.reliability.countA} confiáveis (A)</span>
        <span className="rounded border border-amber-700 bg-amber-900/50 px-2 py-0.5 text-amber-200">{data.reliability.countB} desatualizadas (B)</span>
        <span className="rounded border border-rose-700 bg-rose-900/50 px-2 py-0.5 text-rose-200">{data.reliability.countC} não confiáveis (C)</span>
      </div>

      {data.reliability.blockedCount > 0 && (
        <Banner kind="warn">
          {data.reliability.blockedCount} ativo(s) em nível C com L/P bloqueado — atualize em <strong>Cotações</strong> e veja detalhes em <strong>Patrimônio</strong>.
        </Banner>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Ganhos por mês">
          <BarChart data={data.charts.incomeByMonth.map((m) => ({ label: m.month, value: Number(m.total), color: "bg-emerald-500" }))} />
        </Card>
        <Card title="Gastos por mês">
          <BarChart data={data.charts.expenseByMonth.map((m) => ({ label: m.month, value: Number(m.total), color: "bg-rose-500" }))} />
        </Card>
        <Card title="Gastos por categoria" className="md:col-span-2">
          <BarChart data={data.charts.expenseByCategory.map((c) => ({ label: c.category, value: Number(c.total), color: "bg-amber-500" }))} />
        </Card>
      </div>
      {months.length === 0 && <p className="text-xs text-slate-500">Adicione ganhos e gastos para ver os gráficos.</p>}
    </div>
  );
}
