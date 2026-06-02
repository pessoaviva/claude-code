import { useState } from "react";
import { resetAll } from "./lib/store";
import { Dashboard } from "./pages/Dashboard";
import { Transactions, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from "./pages/Transactions";
import { Stocks } from "./pages/Stocks";
import { Quotes } from "./pages/Quotes";
import { NetWorth } from "./pages/NetWorth";
import { Sales } from "./pages/Sales";
import { Goals } from "./pages/Goals";
import { Audit } from "./pages/Audit";

const NAV = [
  { id: "dashboard", label: "Dashboard" },
  { id: "income", label: "Ganhos" },
  { id: "expenses", label: "Gastos" },
  { id: "stocks", label: "Ações" },
  { id: "quotes", label: "Cotações" },
  { id: "networth", label: "Patrimônio" },
  { id: "sales", label: "Vendas" },
  { id: "goals", label: "Metas" },
  { id: "audit", label: "Auditoria" },
] as const;

type Tab = (typeof NAV)[number]["id"];

export function App() {
  const [tab, setTab] = useState<Tab>("dashboard");

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <span className="text-lg font-bold text-indigo-400">FinTrack<span className="text-slate-100"> Pro</span></span>
          <nav className="ml-6 flex flex-wrap gap-1">
            {NAV.map((n) => (
              <button
                key={n.id}
                onClick={() => setTab(n.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === n.id ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "dashboard" && <Dashboard />}
        {tab === "income" && <Transactions endpoint="/income" categories={INCOME_CATEGORIES} title="Ganhos" accent="text-emerald-400" />}
        {tab === "expenses" && <Transactions endpoint="/expenses" categories={EXPENSE_CATEGORIES} title="Gastos" accent="text-rose-400" />}
        {tab === "stocks" && <Stocks />}
        {tab === "quotes" && <Quotes />}
        {tab === "networth" && <NetWorth />}
        {tab === "sales" && <Sales />}
        {tab === "goals" && <Goals />}
        {tab === "audit" && <Audit />}
      </main>

      <footer className="mx-auto max-w-7xl px-4 py-8 text-xs text-slate-500">
        Dados salvos somente neste navegador (localStorage) — nada é enviado a servidores.{" "}
        <button
          onClick={() => {
            if (confirm("Apagar TODOS os dados deste navegador? Esta ação não pode ser desfeita.")) {
              resetAll();
              location.reload();
            }
          }}
          className="text-rose-400 hover:underline"
        >
          Limpar todos os dados
        </button>
      </footer>
    </div>
  );
}
