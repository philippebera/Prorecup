import { headers } from "next/headers";
import { Container, NavTabs, Alert } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/loueur", label: "Tableau de bord" },
  { href: "/loueur/demandes", label: "Demandes" },
  { href: "/loueur/contacts", label: "Contacts débloqués" },
  { href: "/loueur/portefeuille", label: "Crédits et factures" },
  { href: "/loueur/entreprise", label: "Entreprise" },
  { href: "/loueur/equipe", label: "Utilisateurs" },
  { href: "/loueur/notifications", label: "Notifications" },
];

export default async function EspaceLoueur({ children }: { children: React.ReactNode }) {
  const { company } = await requirePageProvider("/loueur");
  const path = (await headers()).get("x-pathname") ?? "/loueur";
  return (
    <Container className="pb-28 pt-4 sm:pb-6">
      <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-semibold ring-1 ring-black/[0.06]">
        <span className={`h-2 w-2 rounded-full ${company.status === "APPROVED" ? "bg-brand-500" : "bg-amber-500"}`} />
        {company.tradeName || company.legalName}
      </p>
      <NavTabs items={NAV} current={path} />
      {company.status === "PENDING" && (
        <div className="mb-6">
          <Alert tone="warn" title="Inscription en cours de validation">
            Notre équipe vérifie les informations de votre entreprise. Vous pourrez débloquer des contacts après validation. Les crédits de découverte sont ajoutés à ce moment-là.
          </Alert>
        </div>
      )}
      {company.status === "SUSPENDED" && <div className="mb-6"><Alert tone="error" title="Compte suspendu">{company.statusReason ?? "Contactez l'administration."}</Alert></div>}
      {company.status === "REJECTED" && <div className="mb-6"><Alert tone="error" title="Inscription refusée">{company.statusReason ?? "Contactez l'administration."}</Alert></div>}
      {children}
      <BottomNav current={path} items={[
        { href: "/loueur", label: "Tableau de bord", icon: "home" },
        { href: "/loueur/demandes", label: "Demandes", icon: "list" },
        { href: "/loueur/contacts", label: "Contacts débloqués", icon: "contacts" },
        { href: "/loueur/portefeuille", label: "Crédits et factures", icon: "wallet" },
        { href: "/loueur/entreprise", label: "Entreprise", icon: "settings" },
      ]} />
    </Container>
  );
}
