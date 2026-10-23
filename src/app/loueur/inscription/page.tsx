import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle } from "@/components/ui";
import { CompanyForm, emptyCompany } from "@/components/company-form";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { euros, vatFromHt } from "@/lib/money";

export const metadata: Metadata = { title: "Inscription loueur de bennes", robots: { index: false, follow: true } };
export const dynamic = "force-dynamic";

export default async function InscriptionPage() {
  const settings = await getSettings();
  const packs = await prisma.creditPack.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
  return (
    <Container className="max-w-3xl py-8">
      <PageTitle title="Inscrire mon entreprise" subtitle="Inscription gratuite. Validation par notre équipe avant de pouvoir débloquer des contacts." />
      <div className="card mb-6 text-sm text-ink-soft">
        <ul className="space-y-1">
          <li>✔ Consultation gratuite des demandes de vos zones (sans coordonnées).</li>
          <li>✔ 1 crédit = 1 contact débloqué. {settings.welcomeCredits > 0 && `${settings.welcomeCredits} crédits de découverte offerts après validation (une fois par entreprise).`}</li>
          <li>✔ Packs sans abonnement : {packs.map((p) => `${p.credits} crédits ${euros(p.priceHtCents)} HT (${euros(vatFromHt(p.priceHtCents, settings.vatRateBp).ttc)} TTC)`).join(" · ")}.</li>
          <li>✔ Vos prix sont libres. Aucune commission sur vos locations.</li>
        </ul>
        <p className="mt-2">Déjà inscrit ? <Link className="font-semibold text-brand-700" href="/connexion?next=/loueur">Connectez-vous</Link>. Votre entreprise a déjà un compte ? Demandez une invitation à son responsable.</p>
      </div>
      <CompanyForm mode="register" initial={emptyCompany} />
    </Container>
  );
}
