import { PageTitle, Alert } from "@/components/ui";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { euros, vatFromHt } from "@/lib/money";
import { JsonForm } from "../forms";
import { SellerJsonForm } from "./seller-form";

export default async function AdminParametres() {
  const [s, packs] = await Promise.all([getSettings(), prisma.creditPack.findMany({ orderBy: { sortOrder: "asc" } })]);
  return (
    <>
      <PageTitle title="Paramètres" />
      <section className="card mb-6">
        <h2 className="mb-1 font-bold">Modèle de crédits et règles</h2>
        <p className="mb-3 text-sm text-ink-mute">Les modifications s&apos;appliquent aux nouvelles opérations. Le plafond d&apos;une demande est figé au moment de sa diffusion.</p>
        <JsonForm url="/api/admin/settings" method="PUT" initial={s} fields={[
          { name: "creditsPerUnlock", label: "Crédits par déblocage", type: "number" },
          { name: "maxUnlocksPerRequest", label: "Entreprises max. par demande", type: "number" },
          { name: "welcomeCredits", label: "Crédits de découverte (une fois par SIREN)", type: "number" },
          { name: "vatRateBp", label: "TVA (points de base : 2000 = 20 %)", type: "number" },
          { name: "claimWindowDays", label: "Délai de signalement (jours)", type: "number" },
          { name: "unlockAccessDays", label: "Durée d'accès à un contact débloqué (jours)", type: "number" },
          { name: "clientLinkTtlHours", label: "Validité des liens de suivi client (heures)", type: "number" },
          { name: "maxRecipientsPerRequest", label: "Destinataires max. par demande", type: "number" },
          { name: "otpTtlMinutes", label: "Validité des codes de vérification (minutes)", type: "number" },
          { name: "requestRetentionDays", label: "Conservation des demandes avant anonymisation (jours)", type: "number" },
          { name: "invoicePrefix", label: "Préfixe des factures" },
          { name: "commercialPolicyValidated", label: "Politique commerciale validée (restitutions, remboursements)", type: "checkbox" },
        ]} />
      </section>

      <section className="card mb-6">
        <h2 className="mb-1 font-bold">Identité de l&apos;exploitant (factures)</h2>
        {!s.seller.legalName && <div className="mb-3"><Alert tone="warn">Non renseignée : aucune facture ne peut être émise. Aucune identité n&apos;est inventée par l&apos;application.</Alert></div>}
        <SellerJsonForm seller={s.seller} />
      </section>

      <section className="card">
        <h2 className="mb-1 font-bold">Packs de crédits</h2>
        <p className="mb-3 text-sm text-ink-mute">Les achats passés conservent le prix payé. Prix TTC calculé avec la TVA courante.</p>
        <div className="space-y-4">
          {packs.map((p) => (
            <details key={p.id} className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer">{p.name} — {p.credits} crédits — {euros(p.priceHtCents)} HT / {euros(vatFromHt(p.priceHtCents, s.vatRateBp).ttc)} TTC {p.active ? "" : "(inactif)"}</summary>
              <div className="mt-3"><JsonForm url="/api/admin/packs" initial={{ ...p }} fields={PACK_FIELDS} /></div>
            </details>
          ))}
          <details className="rounded-lg border border-dashed border-slate-300 p-3">
            <summary className="cursor-pointer">Nouveau pack</summary>
            <div className="mt-3"><JsonForm url="/api/admin/packs" initial={{ code: "", name: "", credits: 10, priceHtCents: 9000, active: true, sortOrder: packs.length + 1 }} fields={PACK_FIELDS} submitLabel="Créer" /></div>
          </details>
        </div>
      </section>
    </>
  );
}

const PACK_FIELDS = [
  { name: "code", label: "Code (ex. PACK_5)" },
  { name: "name", label: "Nom affiché" },
  { name: "credits", label: "Crédits", type: "number" as const },
  { name: "priceHtCents", label: "Prix HT (centimes)", type: "number" as const },
  { name: "sortOrder", label: "Ordre", type: "number" as const },
  { name: "active", label: "Actif", type: "checkbox" as const },
];
