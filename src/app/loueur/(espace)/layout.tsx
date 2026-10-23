import { headers } from "next/headers";
import { Container, NavTabs, Alert } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";

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
    <Container className="py-6">
      <p className="mb-2 text-sm text-ink-mute">{company.tradeName || company.legalName}</p>
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
    </Container>
  );
}
