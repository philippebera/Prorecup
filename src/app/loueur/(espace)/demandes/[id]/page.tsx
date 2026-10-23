import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle, Alert, Badge, DL } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { getPreviewForCompany, getUnlockedDetails } from "@/lib/requests/views";
import { getBalance } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { prisma } from "@/lib/db";
import { wasteLabel, accessLabel } from "@/lib/catalog";
import { PLACEMENT_LABEL, CONTACT_LABEL, CLIENT_TYPE_LABEL, dateFr } from "@/lib/format";
import { CALLBACK_SLOTS } from "@/lib/requests/schema";
import { UNLOCK_WARNING } from "@/lib/unlock";
import { CLAIM_REASONS } from "@/lib/claims";
import { PERMIT_STATUS_LABELS } from "@/lib/permits";
import { OfferCard } from "@/components/offer-card";
import { ClaimForm, OfferForm, UnlockPanel } from "./client";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ achat?: string }> };

export default async function DemandeDetail({ params, searchParams }: Props) {
  const { id } = await params;
  const { achat } = await searchParams;
  const { company } = await requirePageProvider(`/loueur/demandes/${id}`);
  const preview = await getPreviewForCompany(id, company.id);
  if (!preview) notFound();
  const [details, balance, settings, packs] = await Promise.all([
    getUnlockedDetails(id, company.id),
    getBalance(company.id),
    getSettings(),
    prisma.creditPack.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);
  const purchase = achat ? await prisma.purchase.findFirst({ where: { id: achat, companyId: company.id } }) : null;

  const previewItems: [string, React.ReactNode][] = [
    ["Commune", `${preview.city} (${preview.departmentName})`],
    ["Demandeur", CLIENT_TYPE_LABEL[preview.clientType]],
    ["Dates souhaitées", `Pose ${dateFr(preview.startDate)}${preview.endDate ? ` · retrait ${dateFr(preview.endDate)}` : ""}${preview.flexibleDates ? " (flexibles)" : ""}`],
    ["Déchets", preview.wasteTypes.map(wasteLabel).join(", ")],
    ["Volume estimé", preview.volumeM3 ? `${preview.volumeM3} m³` : "Le client ne sait pas"],
    ["Emplacement", PLACEMENT_LABEL[preview.placement]],
    ["Contraintes", preview.accessFlags.map(accessLabel).join(", ") || "Aucune signalée"],
    ["Contact souhaité", CONTACT_LABEL[preview.contactChannels]],
    ["Publiée le", dateFr(preview.publishedAt, true)],
    ["Places restantes", `${preview.placesLeft} sur ${preview.maxPlaces}`],
  ];

  return (
    <>
      <nav className="mb-3 text-sm"><Link className="text-brand-700" href="/loueur/demandes">← Demandes</Link></nav>
      <PageTitle
        title={`Demande ${preview.publicRef.replace("-", "\u2011")}`}
        subtitle={<span className="flex flex-wrap gap-2">{preview.urgent && <Badge tone="red">Urgent</Badge>}{details ? <Badge tone="blue">Débloquée</Badge> : preview.available ? <Badge tone="green">Ouverte</Badge> : <Badge>Indisponible</Badge>}</span>}
      />

      {purchase && !details && (
        <div className="mb-4">
          {purchase.status === "PAID" ? (
            <Alert tone="success" title="Crédits ajoutés">Votre paiement est confirmé. Le déblocage n&apos;est pas automatique : la demande a pu évoluer entre-temps, confirmez ci-dessous si vous souhaitez toujours la débloquer.</Alert>
          ) : purchase.status === "FAILED" || purchase.status === "EXPIRED" ? (
            <Alert tone="error">Le paiement n&apos;a pas abouti. Aucun crédit n&apos;a été ajouté.</Alert>
          ) : (
            <Alert tone="info" title="Paiement en cours de confirmation">Les crédits seront ajoutés dès que Stripe aura confirmé le paiement (cela peut prendre quelques instants, ou plusieurs jours pour un prélèvement). Actualisez la page.</Alert>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card">
            <h2 className="mb-3 text-lg font-bold">Aperçu de la demande</h2>
            <DL items={previewItems} />
            {preview.hasPhotos && !details && <p className="mt-3 text-sm text-ink-mute">Photos disponibles après déblocage.</p>}
          </section>

          {details && !details.expired && (
            <section className="card ring-2 ring-lime">
              <h2 className="mb-3 text-lg font-bold">Coordonnées et adresse du chantier</h2>
              {details.closedStatus && <div className="mb-3"><Alert tone="warn">Le client a clôturé cette demande ({details.closedStatus === "FULFILLED" ? "loueur trouvé" : "fermée ou annulée"}).</Alert></div>}
              <DL items={[
                ["Contact", `${details.contactName}${details.companyName ? ` — ${details.companyName}` : ""}`],
                ["Téléphone", details.phone ?? (preview.contactChannels === "EMAIL" ? "Non communiqué (contact par email souhaité)" : "—")],
                ["Email", details.email ?? (preview.contactChannels === "PHONE" ? "Non communiqué (contact par téléphone souhaité)" : "—")],
                ["Créneaux de rappel", details.callbackHours ? details.callbackHours.split(",").map((c) => CALLBACK_SLOTS.find((s) => s.code === c)?.label ?? c).join(", ") : "—"],
                ["Adresse", `${details.addressLine}${details.addressComplement ? `, ${details.addressComplement}` : ""}, ${details.postalCode} ${details.city}`],
                ["Précisions d'accès", details.accessDetails ?? "—"],
                ["Précisions sur les déchets", details.wasteNotes ?? "—"],
                ["Autorisation de voirie", details.permitStatus ? PERMIT_STATUS_LABELS[details.permitStatus] : "—"],
              ]} />
              <div className="mt-4 flex flex-wrap gap-2">
                {details.phone && <a className="btn-primary" href={`tel:${details.phone}`}>Appeler</a>}
                {details.email && <a className="btn-secondary" href={`mailto:${details.email}?subject=${encodeURIComponent(`Votre demande de benne ${preview.publicRef}`)}`}>Envoyer un email</a>}
                <a className="btn-secondary" href="#offre">Envoyer une offre</a>
              </div>
              {details.photos.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {details.photos.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer"><img src={p.url} alt="Photo du chantier" className="h-28 w-28 rounded-2xl object-cover" /></a>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-ink-mute">Ces coordonnées sont communiquées pour répondre à cette demande uniquement. Toute prospection publicitaire est interdite.</p>
            </section>
          )}
          {details?.expired && <Alert tone="warn">La durée d&apos;accès à ce contact est dépassée (débloqué le {dateFr(details.unlockedAt)}).</Alert>}

          {details && !details.expired && <OffersSection requestId={id} companyId={company.id} closed={!!details.closedStatus} volume={preview.volumeM3} />}
          {details && !details.expired && <ClaimSection unlockId={details.unlockId} unlockedAt={details.unlockedAt} windowDays={settings.claimWindowDays} />}
        </div>

        <aside className="space-y-4">
          {!details && (
            <UnlockPanel
              requestId={id}
              available={preview.available}
              approved={company.status === "APPROVED"}
              balance={balance}
              warning={UNLOCK_WARNING}
              packs={packs.map((p) => ({ id: p.id, name: p.name, credits: p.credits }))}
            />
          )}
          <div className="card text-sm">
            <p className="font-semibold">Solde : {balance} crédit(s)</p>
            <p className="mt-1 text-ink-soft">1 crédit = 1 contact pour votre entreprise. Un contact débloqué reste accessible à tous vos utilisateurs sans nouveau débit.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

async function OffersSection({ requestId, companyId, closed, volume }: { requestId: string; companyId: string; closed: boolean; volume: number | null }) {
  const offers = await prisma.offer.findMany({ where: { requestId, companyId }, include: { company: true }, orderBy: { createdAt: "desc" } });
  return (
    <section id="offre" className="space-y-3">
      <h2 className="text-lg font-bold">Vos offres</h2>
      {offers.map((o) => <OfferCard key={o.id} offer={o} companyName={o.status === "WITHDRAWN" ? `${o.company.legalName} (retirée)` : o.company.tradeName || o.company.legalName} />)}
      {!closed ? <OfferForm requestId={requestId} defaultVolume={volume} /> : <p className="text-sm text-ink-mute">Demande clôturée : plus d&apos;offre possible.</p>}
    </section>
  );
}

async function ClaimSection({ unlockId, unlockedAt, windowDays }: { unlockId: string; unlockedAt: Date; windowDays: number }) {
  const claim = await prisma.claim.findUnique({ where: { unlockId } });
  const deadline = new Date(unlockedAt.getTime() + windowDays * 86400_000);
  return (
    <section className="card">
      <h2 className="text-lg font-bold">Signaler un problème sur ce contact</h2>
      {claim ? (
        <p className="mt-2 text-sm">Signalement {claim.status === "OPEN" ? "en cours d'examen" : claim.status === "ACCEPTED" ? "accepté : crédit restitué" : "refusé"}{claim.resolution ? ` — ${claim.resolution}` : ""}.</p>
      ) : deadline < new Date() ? (
        <p className="mt-2 text-sm text-ink-mute">Délai de signalement dépassé ({windowDays} jours après le déblocage).</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-soft">Possible jusqu&apos;au {dateFr(deadline, true)}. Un refus de devis, le choix d&apos;un concurrent ou l&apos;absence de location ne donnent pas droit à restitution.</p>
          <ClaimForm unlockId={unlockId} reasons={CLAIM_REASONS} />
        </>
      )}
    </section>
  );
}
