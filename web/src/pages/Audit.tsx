import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { dateTimeBR } from "../lib/format";
import { Banner, Card, Select, Stat, Table } from "../components/ui";

interface Log {
  id: string;
  ts: string;
  category: string;
  entity: string;
  entity_id: string | null;
  action: string;
  actor: string;
  details: Record<string, unknown>;
}

interface Diagnostics {
  database: { ok: boolean; latencyMs: number | null };
  quoteProvider: { url: string; tokenConfigured: boolean; timeoutMs: number };
  errors24h: number;
  lastError: Log | null;
  lastQuoteActivity: Log | null;
  auditCounts: { category: string; count: string }[];
  uptimeSec: number;
}

const CATEGORIES = ["all", "change", "quote", "error", "integration", "manual"];
const CAT_COLOR: Record<string, string> = {
  change: "bg-indigo-900 text-indigo-200",
  quote: "bg-sky-900 text-sky-200",
  error: "bg-rose-900 text-rose-200",
  integration: "bg-violet-900 text-violet-200",
  manual: "bg-amber-900 text-amber-200",
};

export function Audit() {
  const [tab, setTab] = useState<"logs" | "diagnostics">("logs");
  const [category, setCategory] = useState("all");
  const logs = useFetch<Log[]>(() => api.get(`/audit/logs?category=${category}`), [category]);
  const diag = useFetch<Diagnostics>(() => api.get("/audit/diagnostics"), []);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["logs", "diagnostics"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
          >
            {t === "logs" ? "Logs" : "Diagnóstico"}
          </button>
        ))}
      </div>

      {tab === "logs" && (
        <Card title="Registro de auditoria">
          <div className="mb-3 max-w-xs">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === "all" ? "Todas as categorias" : c}</option>)}
            </Select>
          </div>
          {logs.error && <Banner kind="error">{logs.error}</Banner>}
          {logs.data && (
            <Table headers={["Data/Hora", "Categoria", "Entidade", "Ação", "Detalhes"]}>
              {logs.data.map((l) => (
                <tr key={l.id} className="border-b border-slate-800/50 align-top">
                  <td className="px-2 py-2 whitespace-nowrap text-slate-400">{dateTimeBR(l.ts)}</td>
                  <td className="px-2 py-2"><span className={`rounded px-2 py-0.5 text-xs ${CAT_COLOR[l.category] ?? "bg-slate-800"}`}>{l.category}</span></td>
                  <td className="px-2 py-2">{l.entity}{l.entity_id ? ` #${l.entity_id}` : ""}</td>
                  <td className="px-2 py-2">{l.action}</td>
                  <td className="px-2 py-2 font-mono text-xs text-slate-400">{JSON.stringify(l.details)}</td>
                </tr>
              ))}
              {logs.data.length === 0 && <tr><td colSpan={5} className="px-2 py-4 text-center text-slate-500">Sem registros.</td></tr>}
            </Table>
          )}
        </Card>
      )}

      {tab === "diagnostics" && diag.data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Banco de dados" value={diag.data.database.ok ? "OK" : "FALHA"} accent={diag.data.database.ok ? "text-emerald-400" : "text-rose-400"} sub={`latência ${diag.data.database.latencyMs ?? "—"} ms`} />
            <Stat label="Erros (24h)" value={String(diag.data.errors24h)} accent={diag.data.errors24h > 0 ? "text-amber-400" : "text-emerald-400"} />
            <Stat label="Uptime" value={`${Math.floor(diag.data.uptimeSec / 60)} min`} />
            <Stat label="Provedor de cotações" value={diag.data.quoteProvider.tokenConfigured ? "token ✓" : "sem token"} sub={diag.data.quoteProvider.url} />
          </div>

          <Card title="Contagem por categoria">
            <div className="flex flex-wrap gap-3">
              {diag.data.auditCounts.map((c) => (
                <span key={c.category} className={`rounded px-3 py-1 text-sm ${CAT_COLOR[c.category] ?? "bg-slate-800"}`}>{c.category}: {c.count}</span>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card title="Último erro">
              {diag.data.lastError ? (
                <pre className="overflow-x-auto text-xs text-rose-300">{JSON.stringify(diag.data.lastError, null, 2)}</pre>
              ) : <p className="text-sm text-emerald-400">Nenhum erro registrado.</p>}
            </Card>
            <Card title="Última atividade de cotação">
              {diag.data.lastQuoteActivity ? (
                <pre className="overflow-x-auto text-xs text-slate-300">{JSON.stringify(diag.data.lastQuoteActivity, null, 2)}</pre>
              ) : <p className="text-sm text-slate-500">Nenhuma cotação registrada.</p>}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
