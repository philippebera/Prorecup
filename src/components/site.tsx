import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { getSessionUser } from "@/lib/auth/server";
import { LogoutButton, NotificationListener } from "./client";
import { Container } from "./ui";

export async function SiteHeader() {
  const user = await getSessionUser();
  const home = user?.role === "ADMIN" ? "/admin" : user?.role === "PROVIDER" ? "/loueur" : user?.role === "CLIENT" ? "/suivi" : null;
  return (
    <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-lg font-extrabold tracking-tight">
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-2xl bg-ink text-lg font-black text-lime">b</span>
          <span className={user ? "hidden min-[420px]:inline" : ""}>{BRAND_NAME}</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <>
              <Link href={home!} className="whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-black/[0.06] hover:bg-canvas">Mon espace</Link>
              <NotificationListener />
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/suivi" className="hidden text-sm font-semibold text-ink-soft hover:text-ink sm:inline">Suivre ma demande</Link>
              <Link href="/loueur/inscription" className="hidden text-sm font-semibold text-ink-soft hover:text-ink sm:inline">Espace loueurs</Link>
              <Link href="/connexion" className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900">Connexion</Link>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-20 rounded-t-4xl bg-ink py-12 text-sm text-white/60 [&_a:hover]:text-lime">
      <Container className="grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-bold text-white">{BRAND_NAME}</p>
          <p className="mt-2">Mise en relation gratuite pour les demandeurs avec des loueurs de bennes. Le prix et le paiement de la location se règlent directement avec le loueur.</p>
        </div>
        <div>
          <p className="font-bold text-white">Ressources</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/guides">Guides pratiques</Link></li>
            <li><Link href="/zones">Zones couvertes</Link></li>
            <li><Link href="/loueur/inscription">Vous êtes loueur ?</Link></li>
            <li><Link href="/suivi/lien">Retrouver ma demande</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-bold text-white">Informations</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/legal/mentions-legales">Mentions légales</Link></li>
            <li><Link href="/legal/confidentialite">Confidentialité</Link></li>
            <li><Link href="/legal/cgu">Conditions d&apos;utilisation</Link></li>
            <li><Link href="/legal/conditions-loueurs">Conditions loueurs et crédits</Link></li>
          </ul>
        </div>
      </Container>
    </footer>
  );
}
