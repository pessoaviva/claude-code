import React from "react";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line/80 bg-gradient-to-b from-surface/90 to-surface/70 p-5 shadow-lg shadow-black/5 dark:shadow-black/20 ${className}`}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export type Tone = "teal" | "emerald" | "rose" | "amber" | "orange" | "slate";

const TONE: Record<Tone, { chip: string; value: string; ring: string }> = {
  teal: { chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300", value: "text-teal-700 dark:text-teal-300", ring: "from-teal-500/10" },
  emerald: { chip: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", value: "text-emerald-600 dark:text-emerald-400", ring: "from-emerald-500/10" },
  rose: { chip: "bg-rose-500/15 text-rose-700 dark:text-rose-300", value: "text-rose-600 dark:text-rose-400", ring: "from-rose-500/10" },
  amber: { chip: "bg-amber-500/15 text-amber-700 dark:text-amber-300", value: "text-amber-600 dark:text-amber-400", ring: "from-amber-500/10" },
  orange: { chip: "bg-orange-500/15 text-orange-700 dark:text-orange-300", value: "text-orange-700 dark:text-orange-300", ring: "from-orange-500/10" },
  slate: { chip: "bg-line/40 text-muted", value: "text-fg", ring: "from-faint/10" },
};

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-br ${t.ring} to-surface/70 p-4 shadow-lg shadow-black/5 dark:shadow-black/20`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wide text-muted">{label}</div>
        {icon && <span className={`grid h-8 w-8 place-items-center rounded-lg text-base ${t.chip}`}>{icon}</span>}
      </div>
      <div className={`mt-2 text-2xl font-bold tracking-tight ${t.value}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary:
      "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-md shadow-teal-900/40 hover:from-teal-500 hover:to-cyan-500",
    ghost: "border border-line bg-surface/60 text-fg hover:border-faint hover:bg-line",
    danger: "bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-900/40 hover:from-rose-500 hover:to-red-500",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/60 disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function IconButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-lg px-2 py-1 text-sm text-muted transition hover:bg-line hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 ${props.className ?? ""}`}
    >
      {children}
    </button>
  );
}

const fieldBase =
  "w-full rounded-xl border border-line bg-bg/80 px-3 py-2 text-sm text-fg outline-none transition placeholder:text-faint focus:border-teal-500 focus:ring-2 focus:ring-teal-500/30";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldBase} ${props.className ?? ""}`} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">
        {label} {hint && <span className="text-faint">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
            {headers.map((h, i) => (
              <th key={i} className="px-3 py-2.5 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm dark:bg-black/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} animate-fade-in rounded-2xl border border-line/70 bg-surface p-6 shadow-2xl shadow-black/50`}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <IconButton onClick={onClose} aria-label="Fechar">✕</IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ children, icon = "📭" }: { children: React.ReactNode; icon?: string }) {
  return (
    <div className="grid place-items-center gap-2 py-12 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-line/60 text-2xl">{icon}</span>
      <p className="max-w-sm text-sm text-faint">{children}</p>
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition ${
            active === t.id
              ? "bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow shadow-teal-900/40"
              : "text-muted hover:bg-line"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/** Selo de status pago/pendente. Clicável quando `onClick` é informado. */
export function StatusBadge({ paid, onClick }: { paid: boolean; onClick?: () => void }) {
  const cls = paid
    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400";
  const label = paid ? "✓ Pago" : "⏳ Pendente";
  if (onClick) {
    return (
      <button
        onClick={onClick}
        title="Clique para alternar"
        className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-125 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50 ${cls}`}
      >
        {label}
      </button>
    );
  }
  return <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{label}</span>;
}
