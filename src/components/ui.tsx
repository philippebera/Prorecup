import Link from "next/link";
import type { ReactNode } from "react";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{title}</h1>
        {subtitle && <div className="mt-1.5 text-ink-soft">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  green: "bg-lime-soft text-brand-800",
  lime: "bg-lime text-ink",
  dark: "bg-ink text-white",
  gray: "bg-canvas text-ink-soft",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-900",
};

export function Badge({ children, tone = "gray" }: { children: ReactNode; tone?: keyof typeof tones }) {
  return <span className={`chip ${tones[tone]}`}>{children}</span>;
}

export function Alert({ children, tone = "info", title }: { children: ReactNode; tone?: "info" | "warn" | "error" | "success"; title?: string }) {
  const cls = {
    info: "bg-white text-ink ring-1 ring-black/[0.06]",
    warn: "bg-amber-50 text-amber-950 ring-1 ring-amber-200",
    error: "bg-red-50 text-red-900 ring-1 ring-red-200",
    success: "bg-lime-soft text-brand-900 ring-1 ring-lime-dark/40",
  }[tone];
  const dot = { info: "bg-sky-500", warn: "bg-amber-500", error: "bg-red-600", success: "bg-brand-500" }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`flex gap-3 rounded-2xl px-4 py-3 text-sm ${cls}`}>
      <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        {title && <p className="mb-0.5 font-bold">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Statistique ; la variante « dark » reprend le style des widgets sombres à valeur lime. */
export function Stat({ label, value, hint, dark = false }: { label: string; value: ReactNode; hint?: string; dark?: boolean }) {
  return (
    <div className={dark ? "card-dark" : "card"}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${dark ? "text-white/60" : "text-ink-mute"}`}>{label}</p>
      <p className={`mt-1.5 text-3xl font-extrabold tracking-tight ${dark ? "text-lime" : ""}`}>{value}</p>
      {hint && <p className={`mt-1 text-xs ${dark ? "text-white/50" : "text-ink-mute"}`}>{hint}</p>}
    </div>
  );
}

export function NavTabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="no-scrollbar -mx-4 mb-6 overflow-x-auto px-4" aria-label="Navigation de l'espace">
      <ul className="flex min-w-max gap-1.5">
        {items.map((i) => {
          const active = current === i.href || (i.href !== items[0].href && current.startsWith(i.href));
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-4 py-2 text-sm font-semibold transition ${active ? "bg-ink text-white" : "bg-white text-ink-soft ring-1 ring-black/[0.06] hover:text-ink"}`}
              >
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
  return <div className="rounded-3xl border-2 border-dashed border-black/10 bg-white/60 px-4 py-12 text-center text-ink-mute">{children}</div>;
}

export function DL({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-mute">{k}</dt>
          <dd className="mt-0.5 text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
