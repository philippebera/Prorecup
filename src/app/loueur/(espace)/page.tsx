import Link from "next/link";
import { PageTitle, Stat, Empty, Badge } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { getBalance } from "@/lib/credits";
import { listPreviewsForCompany } from "@/lib/requests/views";
import { prisma } from "@/lib/db";
import { PreviewCard } from "@/components/preview-card";

export default async function LoueurHome() {
  const { company, user } = await requirePageProvider();
  const [balance, previews, unlocks, offers, verifs] = await Promise.all([
    getBalance(company.id),
    listPreviewsForCompany(company.id, { onlyOpen: true }),
    prisma.unlock.count({ where: { companyId: company.id } }),
    prisma.offer.count({ where: { companyId: company.id } }),
    prisma.companyVerification.findMany({ where: { companyId: company.id } }),
  ]);
  return (
    <>
      <PageTitle title={`Bonjour ${user.name}`} actions={<Link className="btn-primary" href="/loueur/portefeuille">Acheter des crédits</Link>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Solde de crédits" value={balance} hint="Rattaché à l'entreprise" />
        <Stat label="Demandes ouvertes" value={previews.filter((p) => p.available && !p.unlockedByMe).length} />
        <Stat label="Contacts débloqués" value={unlocks} />
        <Stat label="Offres envoyées" value={offers} />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-bold">Demandes récentes dans votre zone</h2>
      {previews.length === 0 ? (
        <Empty>Aucune demande ouverte pour le moment.</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {previews.slice(0, 6).map((p) => (
            <PreviewCard key={p.id} p={p} />
          ))}
        </div>
      )}
      <div className="card mt-8">
        <h2 className="font-bold">Informations vérifiées par l&apos;administration</h2>
        <p className="mt-1 text-sm text-ink-soft">Les autres informations de votre profil sont déclaratives.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {verifs.length ? verifs.map((v) => <Badge key={v.id} tone="green">✔ {v.field}</Badge>) : <span className="text-sm text-ink-mute">Aucune pour l&apos;instant.</span>}
        </div>
      </div>
    </>
  );
}
