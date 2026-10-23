import type { Metadata } from "next";
import { headers } from "next/headers";
import { Container, NavTabs } from "@/components/ui";
import { requirePageUser } from "@/lib/auth/server";

export const metadata: Metadata = { title: "Administration", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/entreprises", label: "Entreprises" },
  { href: "/admin/demandes", label: "Demandes" },
  { href: "/admin/signalements", label: "Signalements" },
  { href: "/admin/paiements", label: "Paiements" },
  { href: "/admin/credits", label: "Crédits" },
  { href: "/admin/abus", label: "Doublons et abus" },
  { href: "/admin/voirie", label: "Démarches voirie" },
  { href: "/admin/notifications", label: "Notifications" },
  { href: "/admin/integrations", label: "Intégrations" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageUser("ADMIN", "/admin");
  const path = (await headers()).get("x-pathname") ?? "/admin";
  return (
    <Container className="max-w-6xl py-6">
      <NavTabs items={NAV} current={path} />
      {children}
    </Container>
  );
}
