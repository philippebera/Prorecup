import Link from "next/link";
import { notFound } from "next/navigation";
import { Container, PageTitle, Alert, Badge } from "@/components/ui";
import { clientRequestIds } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { findAuthorities, PERMIT_STATUS_LABELS, prefillOfficialForm, loadPermit } from "@/lib/permits";
import { dateFr } from "@/lib/format";
import { emailConfigured } from "@/lib/integrations";
import { signedFileUrl } from "@/lib/storage";
import { PermitForm, PermitStatusActions, PermitUpload, PermitSend } from "./permit-client";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export default async function VoiriePage({ params }: Props) {
  const { id } = await params;
  if (!(await clientRequestIds()).includes(id)) notFound();
  const r = await prisma.request.findUniqueOrThrow({ where: { id } });
  if (!(await prisma.permit.findUnique({ where: { requestId: id } }))) await prisma.permit.create({ data: { requestId: id, startDate: r.startDate, endDate: r.endDate, applicantName: r.contactName } });
  const p = await loadPermit(id);
  const { exact, dept } = await findAuthorities(r.postalCode, r.departmentCode);
  const authorities = [...exact, ...dept];
  const prefill = prefillOfficialForm(p);
  const canSendFromApp = Boolean(p.authority?.submissionEmail && p.authority.submissionEmailVerified && emailConfigured());

  return (
    <Container className="max-w-3xl py-8">
      <nav className="mb-3 text-sm"><Link className="text-brand-700" href={`/suivi/${id}`}>← Retour à la demande</Link></nav>
      <PageTitle title="Assistant d'autorisation de voirie" subtitle={<>Statut : <Badge tone={p.status === "GRANTED" ? "green" : p.status === "REFUSED" ? "red" : "amber"}>{PERMIT_STATUS_LABELS[p.status]}</Badge></>} />
      <div className="mb-6 space-y-2">
        <Alert tone="warn" title="Important">
          Cet assistant vous aide à préparer votre dossier. {""}
          Ce n&apos;est pas un service administratif officiel, et une demande envoyée n&apos;est pas une autorisation accordée.
          Des frais (redevance d&apos;occupation du domaine public) et des délais d&apos;instruction peuvent s&apos;appliquer.
        </Alert>
      </div>

      <section className="card mb-6">
        <h2 className="text-lg font-bold">1. Emplacement, dates et dimensions</h2>
        <p className="mb-3 mt-1 text-sm text-ink-soft">Vous pouvez préparer le dossier avant de choisir un loueur, puis le compléter avec les dimensions confirmées par celui-ci.</p>
        <PermitForm requestId={id} initial={{
          locationDetails: p.locationDetails ?? "", startDate: p.startDate?.toISOString().slice(0, 10) ?? "", endDate: p.endDate?.toISOString().slice(0, 10) ?? "",
          lengthM: p.lengthM?.toString() ?? "", widthM: p.widthM?.toString() ?? "", heightM: p.heightM?.toString() ?? "",
          dimensionsConfirmed: p.dimensionsConfirmed, applicantName: p.applicantName ?? "", applicantQuality: p.applicantQuality ?? "",
          authorityId: p.authorityId ?? "", notes: p.notes ?? "",
        }} authorities={authorities.map((a) => ({ id: a.id, name: a.name }))} address={`${r.addressLine}, ${r.postalCode} ${r.city}`} locked={["GRANTED", "REFUSED"].includes(p.status)} />
      </section>

      <section className="card mb-6">
        <h2 className="text-lg font-bold">2. Autorité compétente</h2>
        {authorities.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">Aucune référence n&apos;est encore enregistrée pour {r.city}. En général, la demande se fait auprès de la mairie de la commune, qui vous indiquera le service compétent (la voie peut relever d&apos;une autre collectivité). Sélectionnez « Autre » une fois l&apos;autorité identifiée.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {authorities.map((a) => (
              <li key={a.id} className={`rounded-2xl border p-3 text-sm ${a.id === p.authorityId ? "bg-lime-soft ring-2 ring-lime-dark" : "border-black/[0.06]"}`}>
                <p className="font-semibold">{a.name}</p>
                {a.instructions && <p className="mt-1 whitespace-pre-line text-ink-soft">{a.instructions}</p>}
                <ul className="mt-1 space-y-0.5">
                  {a.portalUrl && <li>Portail officiel : <a className="text-brand-700 underline" href={a.portalUrl} target="_blank" rel="noreferrer noopener">{a.portalUrl}</a></li>}
                  {a.formUrl && <li>Formulaire : <a className="text-brand-700 underline" href={a.formUrl} target="_blank" rel="noreferrer noopener">{a.formUrl}</a></li>}
                  {a.email && <li>Email : {a.email}</li>}
                  {a.phone && <li>Téléphone : {a.phone}</li>}
                  {a.feesInfo && <li>Frais : {a.feesInfo}</li>}
                  {a.delayInfo && <li>Délais : {a.delayInfo}</li>}
                </ul>
                <p className="mt-1 text-xs text-ink-mute">{a.lastVerifiedAt ? `Informations vérifiées le ${dateFr(a.lastVerifiedAt)}` : "Informations non vérifiées : confirmez-les auprès de l'autorité."}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card mb-6">
        <h2 className="text-lg font-bold">3. Plan et photos</h2>
        <PermitUpload requestId={id} />
        {p.files.length > 0 && (
          <ul className="mt-3 text-sm">
            {p.files.map((f) => <li key={f.id}>• <a className="text-brand-700 underline" href={signedFileUrl(f.storageKey)} target="_blank" rel="noreferrer">{{ PLAN: "Plan", PHOTO: "Photo", AUTHORIZATION: "Autorisation obtenue", OTHER: "Document" }[f.kind] ?? f.kind}</a> ({dateFr(f.createdAt)})</li>)}
          </ul>
        )}
      </section>

      <section className="card mb-6">
        <h2 className="text-lg font-bold">4. Dossier et envoi</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <a className="btn-secondary btn-sm" href={`/api/requests/${id}/permit/pdf`}>Télécharger le dossier récapitulatif (PDF)</a>
        </div>
        {prefill ? <p className="mt-2 text-sm">Préremplissage disponible pour le formulaire officiel de cette autorité.</p> : <p className="mt-2 text-sm text-ink-mute">Aucun modèle officiel connu pour cette autorité : utilisez le dossier récapitulatif et le formulaire de la collectivité.</p>}
        {canSendFromApp ? (
          <PermitSend requestId={id} to={p.authority!.submissionEmail!} ready={p.status === "READY" || p.status === "INFO_REQUESTED"} />
        ) : (
          <div className="mt-3 text-sm text-ink-soft">
            <p className="font-medium text-ink">Comment déposer votre demande :</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5">
              <li>Téléchargez le dossier récapitulatif.</li>
              <li>Déposez-le auprès de l&apos;autorité compétente via son portail, par email ou au guichet, avec son formulaire si elle en impose un.</li>
              <li>Indiquez ci-dessous que vous l&apos;avez envoyé, puis mettez à jour le statut selon la réponse reçue.</li>
            </ol>
          </div>
        )}
      </section>

      <section className="card mb-6">
        <h2 className="text-lg font-bold">5. Suivi</h2>
        <PermitStatusActions requestId={id} status={p.status} hasAuthorization={p.files.some((f) => f.kind === "AUTHORIZATION")} />
        {p.events.length > 0 && (
          <ol className="mt-4 space-y-1 border-l-2 border-black/[0.06] pl-4 text-sm">
            {p.events.map((e) => <li key={e.id}><span className="text-ink-mute">{dateFr(e.createdAt, true)}</span> — {PERMIT_STATUS_LABELS[e.status]}{e.note ? ` · ${e.note}` : ""}</li>)}
          </ol>
        )}
      </section>
    </Container>
  );
}
