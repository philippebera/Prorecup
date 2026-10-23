import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  green: "bg-brand-100 text-brand-800",
  gray: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warn" | "error" | "success"; title?: string }) {
  const cls = {
    info: "border-sky-200 bg-sky-50 text-sky-900",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    error: "border-red-200 bg-red-50 text-red-900",
    success: "border-brand-200 bg-brand-50 text-brand-900",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${cls}`}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card">
      <p className="text-sm text-ink-mute">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-mute">{hint}</p>}
    </div>
  );
}

export function NavTabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="-mx-4 mb-6 overflow-x-auto px-4" aria-label="Navigation de l'espace">
      <ul className="flex min-w-max gap-1 border-b border-slate-200">
        {items.map((i) => {
          const active = current === i.href || (i.href !== items[0].href && current.startsWith(i.href));
          return (
            <li key={i.href}>
              <Link href={i.href} className={`block border-b-2 px-3 py-2 text-sm font-medium ${active ? "border-brand-600 text-brand-700" : "border-transparent text-ink-soft hover:text-ink"}`}>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-ink-mute">{children}</div>;
}

export function DL({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-medium uppercase tracking-wide text-ink-mute">{k}</dt>
          <dd className="mt-0.5 text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
