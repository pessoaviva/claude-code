import { useState } from "react";
import { api } from "../lib/api";
import { useFetch } from "../lib/useFetch";
import { dateTimeBR } from "../lib/format";
import { Banner, Card, ReliabilityBadge, ScorePill, Select, Stat, Table } from "../components/ui";

interface Log {
  id: string; ts: string; category: string; entity: string;
  entity_id: string | null; action: string; actor: string; details: Record<string, unknown>;
}
interface SysDiag {
  database: { ok: boolean; latencyMs: number | null };
  errors24h: number;
  uptimeSec: number;
  auditCounts: { category: string; count: string }[];
}
interface Provider {
  name: string; configured: boolean; disabledReason: string; online: boolean;
  successes: number; failures: number; avgResponseMs: number | null; lastAt: string | null; lastSuccessAt: string | null;
}
interface Health {
  assetsA: number; assetsB: number; assetsC: number;
  apisOnline: number; apisOffline: number; apisDisabled: number;
  lastSync: string | null; avgResponseMs: number | null;
}
interface AssetDiag {
  ticker: string; source: string | null; provider: string | null; url: string | null;
  lastResponse: string | null; at: string | null; responseMs: number | null;
  status: string; lastError: { message: string | null; at: string } | null;
  level: "A" | "B" | "C"; levelLabel: string; score: number;
}

const CATEGORIES = ["all", "change", "quote", "error", "integration", "manual"];
const CAT_COLOR: Record<string, string> = {
  change: "bg-indigo-900 text-indigo-200", quote: "bg-sky-900 text-sky-200",
  error: "bg-rose-900 text-rose-200", integration: "bg-violet-900 text-violet-200",
  manual: "bg-amber-900 text-amber-200",
};

export function Audit() {
  const [tab, setTab] = useState<"logs" | "diagnostics" | "health">("logs");
  const [category, setCategory] = useState("all");
  const logs = useFetch<Log[]>(() => api.get(`/audit/logs?category=${category}`), [category]);
  const sys = useFetch<SysDiag>(() => api.get("/audit/diagnostics"), []);
  const diag = useFetch<{ providers: Provider[]; health: Health }>(() => api.get("/diagnostics"), []);
  const assets = useFetch<AssetDiag[]>(() => api.get("/diagnostics/assets"), []);

  const TABS = [
    { id: "logs", label: "Logs" },
    { id: "diagnostics", label: "Diagnóstico" },
    { id: "health", label: "Saúde" },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === t.id ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}>
            {t.label}
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

      {tab === "diagnostics" && (
        <div className="space-y-4">
          <Card title="Provedores de cotação (fallback)">
            {diag.error && <Banner kind="error">{diag.error}</Banner>}
            {diag.data && (
              <Table headers={["Provedor", "Status", "Sucessos", "Falhas", "Tempo médio", "Última sincronização"]}>
                {diag.data.providers.map((p) => (
                  <tr key={p.name} className="border-b border-slate-800/50">
                    <td className="px-2 py-2 font-medium capitalize">{p.name}</td>
                    <td className="px-2 py-2">
                      {!p.configured ? <span className="text-slate-500" title={p.disabledReason}>não configurado</span>
                        : p.online ? <span className="text-emerald-400">online</span>
                        : <span className="text-rose-400">offline</span>}
                    </td>
                    <td className="px-2 py-2 text-emerald-400">{p.successes}</td>
                    <td className="px-2 py-2 text-rose-400">{p.failures}</td>
                    <td className="px-2 py-2">{p.avgResponseMs != null ? `${p.avgResponseMs} ms` : "—"}</td>
                    <td className="px-2 py-2 text-slate-400">{p.lastAt ? dateTimeBR(p.lastAt) : "—"}</td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card title="Diagnóstico por ativo">
            {assets.error && <Banner kind="error">{assets.error}</Banner>}
            {assets.data && (
              <Table headers={["Ticker", "Conf.", "Score", "Fonte", "Provedor", "Status", "Tempo", "Última atualização", "Último erro", "URL"]}>
                {assets.data.map((a) => (
                  <tr key={a.ticker} className="border-b border-slate-800/50 align-top">
                    <td className="px-2 py-2 font-semibold">{a.ticker}</td>
                    <td className="px-2 py-2"><ReliabilityBadge level={a.level} /></td>
                    <td className="px-2 py-2"><ScorePill score={a.score} /></td>
                    <td className="px-2 py-2 text-xs">{a.source ?? "—"}</td>
                    <td className="px-2 py-2 text-xs">{a.provider ?? "—"}</td>
                    <td className="px-2 py-2 text-xs">{a.status}</td>
                    <td className="px-2 py-2 text-xs">{a.responseMs != null ? `${a.responseMs} ms` : "—"}</td>
                    <td className="px-2 py-2 whitespace-nowrap text-xs text-slate-400">{a.at ? dateTimeBR(a.at) : "—"}</td>
                    <td className="px-2 py-2 text-xs text-rose-300" title={a.lastError?.message ?? ""}>{a.lastError ? (a.lastError.message ?? "").slice(0, 30) : "—"}</td>
                    <td className="px-2 py-2 max-w-[160px] truncate text-[10px] text-slate-500" title={a.url ?? ""}>{a.url ?? "—"}</td>
                  </tr>
                ))}
                {assets.data.length === 0 && <tr><td colSpan={10} className="px-2 py-4 text-center text-slate-500">Nenhum ativo.</td></tr>}
              </Table>
            )}
          </Card>
        </div>
      )}

      {tab === "health" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat label="Ativos nível A" value={String(diag.data?.health.assetsA ?? "—")} accent="text-emerald-400" />
            <Stat label="Ativos nível B" value={String(diag.data?.health.assetsB ?? "—")} accent="text-amber-400" />
            <Stat label="Ativos nível C" value={String(diag.data?.health.assetsC ?? "—")} accent="text-rose-400" />
            <Stat label="Tempo médio de resposta" value={diag.data?.health.avgResponseMs != null ? `${diag.data.health.avgResponseMs} ms` : "—"} />
            <Stat label="APIs online" value={String(diag.data?.health.apisOnline ?? "—")} accent="text-emerald-400" />
            <Stat label="APIs offline" value={String(diag.data?.health.apisOffline ?? "—")} accent="text-rose-400" />
            <Stat label="APIs não configuradas" value={String(diag.data?.health.apisDisabled ?? "—")} />
            <Stat label="Última atualização" value={diag.data?.health.lastSync ? dateTimeBR(diag.data.health.lastSync) : "—"} />
          </div>

          {sys.data && (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Stat label="Banco de dados" value={sys.data.database.ok ? "OK" : "FALHA"} accent={sys.data.database.ok ? "text-emerald-400" : "text-rose-400"} sub={`latência ${sys.data.database.latencyMs ?? "—"} ms`} />
              <Stat label="Erros (24h)" value={String(sys.data.errors24h)} accent={sys.data.errors24h > 0 ? "text-amber-400" : "text-emerald-400"} />
              <Stat label="Uptime" value={`${Math.floor(sys.data.uptimeSec / 60)} min`} />
            </div>
          )}

          {sys.data && (
            <Card title="Contagem de auditoria por categoria">
              <div className="flex flex-wrap gap-3">
                {sys.data.auditCounts.map((c) => (
                  <span key={c.category} className={`rounded px-3 py-1 text-sm ${CAT_COLOR[c.category] ?? "bg-slate-800"}`}>{c.category}: {c.count}</span>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
