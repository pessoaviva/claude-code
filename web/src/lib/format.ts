export function brl(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(value: string | number | null | undefined): string {
  if (value == null) return "—";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n)) return "—";
  return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export function dateBR(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

export function dateTimeBR(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

/** Color class for a signed monetary/percent value. */
export function signColor(value: string | number | null | undefined): string {
  if (value == null) return "text-slate-300";
  const n = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(n) || n === 0) return "text-slate-300";
  return n > 0 ? "text-emerald-400" : "text-rose-400";
}
