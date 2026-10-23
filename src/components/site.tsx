import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { getSessionUser } from "@/lib/auth/server";
import { LogoutButton, NotificationListener } from "./client";
import { Container } from "./ui";

export async function SiteHeader() {
  const user = await getSessionUser();
  const home = user?.role === "ADMIN" ? "/admin" : user?.role === "PROVIDER" ? "/loueur" : user?.role === "CLIENT" ? "/suivi" : null;
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="flex h-14 items-center justify-between gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 whitespace-nowrap font-bold text-brand-800">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-white">B</span>
          <span>{BRAND_NAME}</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-4">
          {user ? (
            <>
              <Link href={home!} className="text-sm font-medium text-ink-soft hover:text-ink">Mon espace</Link>
              <NotificationListener />
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/suivi" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline">Suivre ma demande</Link>
              <Link href="/loueur/inscription" className="hidden text-sm font-medium text-ink-soft hover:text-ink sm:inline">Espace loueurs</Link>
              <Link href="/connexion" className="text-sm font-medium text-ink-soft hover:text-ink">Connexion</Link>
            </>
          )}
        </nav>
      </Container>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-slate-200 bg-white py-10 text-sm text-ink-soft">
      <Container className="grid gap-8 sm:grid-cols-3">
        <div>
          <p className="font-semibold text-ink">{BRAND_NAME}</p>
          <p className="mt-2">Mise en relation gratuite pour les demandeurs avec des loueurs de bennes. Le prix et le paiement de la location se règlent directement avec le loueur.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Ressources</p>
          <ul className="mt-2 space-y-1">
            <li><Link href="/guides">Guides pratiques</Link></li>
            <li><Link href="/zones">Zones couvertes</Link></li>
            <li><Link href="/loueur/inscription">Vous êtes loueur ?</Link></li>
            <li><Link href="/suivi/lien">Retrouver ma demande</Link></li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">Informations</p>
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
