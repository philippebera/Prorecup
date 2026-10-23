import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, PageTitle, Badge, Alert, DL, Empty } from "@/components/ui";
import { clientRequestIds, getSessionUser } from "@/lib/auth/server";
import { getClientView } from "@/lib/requests/service";
import { REQUEST_STATUS, PLACEMENT_LABEL, CONTACT_LABEL, dateFr } from "@/lib/format";
import { wasteLabel, accessLabel } from "@/lib/catalog";
import { OfferCard } from "@/components/offer-card";
import { ClientActions, CreateAccountForm, DraftCompletion } from "../forms";
import { PERMIT_STATUS_LABELS } from "@/lib/permits";
import { signedFileUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function SuiviDetail({ params }: Props) {
  const { id } = await params;
  const ids = await clientRequestIds();
  if (!ids.includes(id)) notFound();
  const r = await getClientView(id);
  const user = await getSessionUser();
  const st = REQUEST_STATUS[r.status];
  const name = (c: { legalName: string; tradeName: string | null }) => c.tradeName || c.legalName;

  return (
    <Container className="max-w-3xl py-8">
      <PageTitle title={`Demande ${r.publicRef.replace("-", "\u2011")}`} subtitle={<>Déposée le {dateFr(r.createdAt)} · <Badge tone={st.tone}>{st.label}</Badge></>} />

      {r.status !== "DRAFT" && (
        <section className="card-dark mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Entreprises ayant vos coordonnées</p>
          <div className="mt-2 flex items-end justify-between gap-4">
            <p className="text-5xl font-extrabold text-lime">{r.unlocks.length}<span className="text-2xl text-white/40">/{r.maxUnlocks}</span></p>
            <div className="flex gap-1.5" aria-hidden>
              {Array.from({ length: r.maxUnlocks }, (_, i) => (
                <span key={i} className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${i < r.unlocks.length ? "bg-lime text-ink" : "bg-white/10 text-white/40"}`}>
                  {i < r.unlocks.length ? name(r.unlocks[i].company).slice(0, 1) : i + 1}
                </span>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm text-white/60">{r.offers.length} offre(s) reçue(s) · {r.recipients.length} entreprise(s) destinataire(s)</p>
        </section>
      )}

      {r.status === "DRAFT" && (
        <section className="card mb-6 space-y-3">
          <h2 className="text-lg font-bold">Finaliser votre demande</h2>
          <p className="text-sm text-ink-soft">Votre demande n&apos;est pas encore diffusée.</p>
          <DraftCompletion requestId={r.id} pref={r.contactPreference} email={r.email} phone={r.phone} emailVerified={!!r.emailVerifiedAt} phoneVerified={!!r.phoneVerifiedAt} maxUnlocks={r.maxUnlocks} />
        </section>
      )}

      {r.status !== "DRAFT" && (
        <section className="card mb-6">
          <h2 className="text-lg font-bold">Entreprises ayant obtenu vos coordonnées ({r.unlocks.length} / {r.maxUnlocks})</h2>
          {r.unlocks.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">Aucune pour l&apos;instant. Nous ne pouvons pas garantir de réponse ni de délai.</p>
          ) : (
            <ul className="mt-3 divide-y divide-black/5">
              {r.unlocks.map((u) => (
                <li key={u.id} className="py-3">
                  <p className="font-semibold">{name(u.company)} <span className="text-sm font-normal text-ink-mute">· {u.company.city}</span></p>
                  <p className="text-sm text-ink-soft">Coordonnées obtenues le {dateFr(u.createdAt, true)}</p>
                  <p className="text-sm">Contact de l&apos;entreprise : {u.company.phone} · {u.company.email}{u.company.website ? ` · ${u.company.website}` : ""}</p>
                  <Link className="text-sm font-medium text-brand-700" href={`/loueurs/${u.company.slug}`}>Profil de l&apos;entreprise</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {r.offers.length > 0 && (
        <section className="mb-6 space-y-3">
          <h2 className="text-lg font-bold">Offres reçues</h2>
          {r.offers.map((o) => <OfferCard key={o.id} offer={o} companyName={name(o.company)} />)}
        </section>
      )}

      {r.status !== "DRAFT" && (
        <section className="card mb-6">
          <h2 className="mb-3 text-lg font-bold">Gérer ma demande</h2>
          <ClientActions requestId={r.id} status={r.status} unlocked={r.unlocks.map((u) => ({ id: u.company.id, name: name(u.company) }))} />
          {r.chosenCompanyId && <p className="mt-3 text-sm">Loueur choisi : {name(r.unlocks.find((u) => u.companyId === r.chosenCompanyId)?.company ?? { legalName: "—", tradeName: null })}</p>}
        </section>
      )}

      {(r.placement === "PUBLIC_ROAD" || r.permit) && (
        <section className="card mb-6">
          <h2 className="text-lg font-bold">Autorisation de voirie</h2>
          <p className="mt-1 text-sm text-ink-soft">Statut du dossier : <strong>{r.permit ? PERMIT_STATUS_LABELS[r.permit.status] : "À préparer"}</strong></p>
          <Link href={`/suivi/${r.id}/voirie`} className="btn-secondary btn-sm mt-3">Ouvrir l&apos;assistant</Link>
        </section>
      )}

      <section className="card mb-6">
        <h2 className="mb-3 text-lg font-bold">Ma demande</h2>
        <DL items={[
          ["Adresse du chantier", `${r.addressLine}${r.addressComplement ? `, ${r.addressComplement}` : ""}, ${r.postalCode} ${r.city}`],
          ["Dates", `Pose ${dateFr(r.startDate)}${r.endDate ? ` · retrait ${dateFr(r.endDate)}` : ""}${r.flexibleDates ? " (flexibles)" : ""}${r.urgent ? " · urgent" : ""}`],
          ["Déchets", r.wasteTypes.map(wasteLabel).join(", ")],
          ["Volume", r.volumeM3 ? `${r.volumeM3} m³` : "Je ne sais pas"],
          ["Emplacement", PLACEMENT_LABEL[r.placement]],
          ["Accès", r.accessFlags.map(accessLabel).join(", ") || "—"],
          ["Contact", `${CONTACT_LABEL[r.contactPreference]} — ${[r.email && `${r.email}${r.emailVerifiedAt ? " ✔ vérifié" : " (non vérifié)"}`, r.phone && `${r.phone}${r.phoneVerifiedAt ? " ✔ vérifié" : " (non vérifié)"}`].filter(Boolean).join(" · ")}`],
          ["Consentements", `${r.contactConsentAt ? `Contact accepté le ${dateFr(r.contactConsentAt)}` : "Contact non encore accepté"} · Prospection plateforme : ${r.marketingConsent ? "acceptée" : "refusée"}`],
        ]} />
        {r.photos.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {r.photos.map((p) => <a key={p.id} href={signedFileUrl(p.storageKey)} target="_blank" rel="noreferrer"><img src={signedFileUrl(p.storageKey)} alt="Photo du chantier" className="h-24 w-24 rounded-2xl object-cover" /></a>)}
          </div>
        )}
      </section>

      {r.status !== "DRAFT" && (
        <section className="card mb-6">
          <h2 className="text-lg font-bold">Entreprises destinataires</h2>
          <p className="mt-1 text-sm text-ink-soft">Votre demande (sans coordonnées ni adresse exacte) a été présentée à :</p>
          {r.recipients.length ? (
            <ul className="mt-2 text-sm">{r.recipients.map((x) => <li key={x.id}>• {name(x.company)} ({x.company.city})</li>)}</ul>
          ) : <Empty>Aucune.</Empty>}
        </section>
      )}

      {r.reports.length > 0 && (
        <section className="card mb-6">
          <h2 className="text-lg font-bold">Mes signalements</h2>
          <ul className="mt-2 text-sm">{r.reports.map((x) => <li key={x.id}>{dateFr(x.createdAt)} — {x.reason} — {x.status === "OPEN" ? "en cours" : "traité"}</li>)}</ul>
        </section>
      )}

      {!user && r.email && r.emailVerifiedAt && (
        <section className="card">
          <h2 className="text-lg font-bold">Créer un compte (facultatif)</h2>
          <p className="mb-3 mt-1 text-sm text-ink-soft">Le lien de suivi est temporaire. Un compte vous permet de retrouver vos demandes avec {r.email}.</p>
          <CreateAccountForm requestId={r.id} />
        </section>
      )}
      {r.status !== "DRAFT" && <Alert tone="info">Vos coordonnées ne sont utilisées que pour cette demande. Les entreprises ne sont pas autorisées à vous adresser de prospection publicitaire sur cette base.</Alert>}
    </Container>
  );
}
