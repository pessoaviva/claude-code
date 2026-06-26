/**
 * Auditoria simples (histórico de ações), guardada no navegador.
 *
 * 👉 Versão genérica do template: registra ações pontuais via `logAudit`
 * (ex.: criou/excluiu usuário). Se o cliente precisar de auditoria detalhada
 * de mudanças nos dados, dá para evoluir aqui depois (ou registrar no Supabase).
 */
export type AuditKind = "create" | "update" | "delete";

export interface AuditEntry {
  id: string;
  at: string; // ISO
  user: string;
  kind: AuditKind;
  text: string;
}

const KEY = "app_audit:v1";
const MAX = 500; // mantém os últimos N registros

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function getAudit(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}

function write(entries: AuditEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
}

/** Registra uma ação no histórico. */
export function logAudit(e: { user: string; kind: AuditKind; text: string }): void {
  try {
    const entry: AuditEntry = { id: uid(), at: new Date().toISOString(), ...e };
    write([entry, ...getAudit()]);
  } catch {
    /* histórico é secundário — nunca quebra o fluxo principal */
  }
}

export function clearAudit(): void {
  localStorage.removeItem(KEY);
}
