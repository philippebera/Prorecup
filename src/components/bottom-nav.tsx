import Link from "next/link";

type Item = { href: string; label: string; icon: "home" | "list" | "contacts" | "wallet" | "settings" };

const ICONS: Record<Item["icon"], React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
  contacts: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M17 11h5M19.5 8.5v5" /></>,
  wallet: <><rect x="2.5" y="6" width="19" height="14" rx="3" /><path d="M2.5 10h19M16 15h2" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
};

/** Barre de navigation flottante sur mobile (style « dock » à pastilles rondes). */
export function BottomNav({ items, current }: { items: Item[]; current: string }) {
  return (
    <nav aria-label="Navigation principale" className="fixed inset-x-0 bottom-3 z-40 px-4 sm:hidden">
      <ul className="mx-auto flex max-w-sm items-center justify-between rounded-full bg-white/95 p-2 shadow-float ring-1 ring-black/[0.06] backdrop-blur">
        {items.map((i) => {
          const active = current === i.href || (i.href !== items[0].href && current.startsWith(i.href));
          return (
            <li key={i.href}>
              <Link href={i.href} aria-label={i.label} aria-current={active ? "page" : undefined}
                className={`grid h-12 w-12 place-items-center rounded-full transition ${active ? "bg-lime text-ink" : "bg-canvas text-ink-soft"}`}>
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{ICONS[i.icon]}</svg>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
