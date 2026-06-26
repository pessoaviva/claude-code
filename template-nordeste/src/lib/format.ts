export function brl(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "R$ 0,00";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0%";
  return `${value.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })}%`;
}

export function dateBR(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value + "T00:00:00").toLocaleDateString("pt-BR");
}

/** Converte "YYYY-MM" no rótulo "junho de 2026". */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** Início da semana (segunda-feira) → "08/06 – 14/06". */
export function weekLabel(weekStart: string): string {
  const s = new Date(weekStart + "T00:00:00");
  if (Number.isNaN(s.getTime())) return weekStart;
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return `${f(s)} – ${f(e)}`;
}
