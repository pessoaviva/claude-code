import React from "react";

export function Card({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow ${className}`}>
      {title && <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h3>}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, accent = "text-slate-100" }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export function Button({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500 ${props.className ?? ""}`}
    />
  );
}

export function Banner({ kind, children }: { kind: "error" | "warn" | "info" | "success"; children: React.ReactNode }) {
  const styles = {
    error: "border-rose-700 bg-rose-950/50 text-rose-200",
    warn: "border-amber-700 bg-amber-950/50 text-amber-200",
    info: "border-sky-700 bg-sky-950/50 text-sky-200",
    success: "border-emerald-700 bg-emerald-950/50 text-emerald-200",
  }[kind];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}

/** Lightweight dependency-free bar chart (SVG). */
export function BarChart({ data, height = 160 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  if (data.length === 0) return <div className="text-sm text-slate-500">Sem dados.</div>;
  return (
    <div className="flex items-end gap-3" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className={`w-full rounded-t ${d.color ?? "bg-indigo-500"}`}
            style={{ height: `${(Math.abs(d.value) / max) * (height - 30)}px` }}
            title={String(d.value)}
          />
          <div className="truncate text-[10px] text-slate-400">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-800 text-left text-xs uppercase text-slate-500">
            {headers.map((h) => (
              <th key={h} className="px-2 py-2 font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
