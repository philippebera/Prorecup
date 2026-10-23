import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle, Badge, DL } from "@/components/ui";
import { prisma } from "@/lib/db";
import { REQUEST_STATUS, PLACEMENT_LABEL, CONTACT_LABEL, dateFr } from "@/lib/format";
import { wasteLabel } from "@/lib/catalog";
import { ActionButton } from "@/components/client";
import { audit } from "@/lib/audit";
import { requirePageUser } from "@/lib/auth/server";

type Props = { params: Promise<{ id: string }> };

export default async function AdminDemande({ params }: Props) {
  const { id } = await params;
  const admin = await requirePageUser("ADMIN");
  const r = await prisma.request.findUnique({
    where: { id },
    include: {
      recipients: { include: { company: { select: { legalName: true, id: true } } } },
      unlocks: { include: { company: { select: { legalName: true, id: true } }, user: { select: { name: true } }, claims: true } },
      offers: { include: { company: { select: { legalName: true } } } },
      reports: true,
      permit: true,
    },
  });
  if (!r) notFound();
  // Consultation de données personnelles par un administrateur : tracée.
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "REQUEST_VIEWED", entityType: "Request", entityId: id });
  const dups = r.fingerprint ? await prisma.request.findMany({ where: { fingerprint: r.fingerprint, NOT: { id } }, select: { id: true, publicRef: true, createdAt: true } }) : [];
  return (
    <>
      <nav className="mb-3 text-sm"><Link className="text-brand-700" href="/admin/demandes">← Demandes</Link></nav>
      <PageTitle title={`Demande ${r.publicRef}`} subtitle={<Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>} actions={
        <>
          {r.status !== "ARCHIVED" && <ActionButton url={`/api/admin/requests/${id}`} data={{ action: "archive" }} prompt={{ field: "reason", question: "Motif de l'archivage (abus, fraude…) ?" }} label="Archiver (bloque les déblocages)" className="btn-danger btn-sm" />}
          <ActionButton url={`/api/admin/requests/${id}`} data={{ action: "anonymize" }} prompt={{ field: "reason", question: "Motif de l'anonymisation (demande de suppression…) ?" }} label="Anonymiser" className="btn-danger btn-sm" confirm="Anonymiser définitivement les données personnelles de cette demande ?" />
        </>
      } />
      {dups.length > 0 && <p className="mb-4 text-sm text-amber-800">Mêmes coordonnées que : {dups.map((d) => <Link key={d.id} className="mr-2 underline" href={`/admin/demandes/${d.id}`}>{d.publicRef} ({dateFr(d.createdAt)})</Link>)}</p>}
      <section className="card mb-6">
        <DL items={[
          ["Client", `${r.contactName}${r.companyName ? ` — ${r.companyName}` : ""}`],
          ["Coordonnées", `${CONTACT_LABEL[r.contactPreference]} : ${[r.email && `${r.email} ${r.emailVerifiedAt ? "✔" : "✗"}`, r.phone && `${r.phone} ${r.phoneVerifiedAt ? "✔" : "✗"}`].filter(Boolean).join(" · ")}`],
          ["Adresse", `${r.addressLine}, ${r.postalCode} ${r.city}`],
          ["Dates", `${dateFr(r.startDate)} → ${dateFr(r.endDate)}`],
          ["Déchets / volume", `${r.wasteTypes.map(wasteLabel).join(", ")} · ${r.volumeM3 ?? "?"} m³`],
          ["Emplacement", PLACEMENT_LABEL[r.placement]],
          ["Consentement contact", r.contactConsentText ? `${dateFr(r.contactConsentAt, true)} — ${r.contactConsentText}` : "—"],
          ["Prospection plateforme", r.marketingConsent ? `acceptée le ${dateFr(r.marketingConsentAt)}` : "refusée"],
          ["Clôture", r.closedAt ? `${dateFr(r.closedAt, true)} ${r.closeReason ?? ""}` : "—"],
          ["Voirie", r.permit?.status ?? "—"],
        ]} />
      </section>
      <section className="card mb-6">
        <h2 className="mb-2 font-bold">Destinataires ({r.recipients.length})</h2>
        <p className="text-sm">{r.recipients.map((x) => x.company.legalName).join(", ") || "—"}</p>
        <h2 className="mb-2 mt-4 font-bold">Déblocages ({r.unlocks.length}/{r.maxUnlocks})</h2>
        <ul className="text-sm">{r.unlocks.map((u) => <li key={u.id}>• {dateFr(u.createdAt, true)} — <Link className="underline" href={`/admin/entreprises/${u.company.id}`}>{u.company.legalName}</Link> par {u.user.name}{u.claims[0] ? ` — signalement ${u.claims[0].status}` : ""}</li>)}</ul>
        <h2 className="mb-2 mt-4 font-bold">Offres ({r.offers.length})</h2>
        <ul className="text-sm">{r.offers.map((o) => <li key={o.id}>• {o.company.legalName} — {(o.amountTtcCents / 100).toFixed(2)} € TTC — {o.status}</li>)}</ul>
        <h2 className="mb-2 mt-4 font-bold">Signalements du client</h2>
        <ul className="text-sm">{r.reports.map((x) => <li key={x.id}>• {x.reason} — {x.message} ({x.status})</li>)}</ul>
      </section>
    </>
  );
}
