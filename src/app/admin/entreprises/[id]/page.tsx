import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle, Badge, DL, Alert } from "@/components/ui";
import { prisma } from "@/lib/db";
import { reconcile } from "@/lib/credits";
import { dateFr } from "@/lib/format";
import { departmentName } from "@/lib/geo";
import { serviceLabel, wasteLabel } from "@/lib/catalog";
import { euros } from "@/lib/money";
import { AdjustCreditsForm, CompanyActions, VerifyFieldForm } from "../../forms";

type Props = { params: Promise<{ id: string }> };

export default async function AdminEntreprise({ params }: Props) {
  const { id } = await params;
  const c = await prisma.company.findUnique({
    where: { id },
    include: {
      members: { include: { user: true } }, zones: true, establishments: true, verifications: true, wallet: true,
      ledger: { orderBy: { createdAt: "desc" }, take: 50 }, purchases: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!c) notFound();
  const [rec, welcome, sameSiren, audits] = await Promise.all([
    reconcile(c.id),
    prisma.welcomeGrant.findUnique({ where: { siren: c.siren } }),
    prisma.company.findMany({ where: { siren: c.siren, NOT: { id: c.id } }, select: { id: true, legalName: true, siret: true } }),
    prisma.auditLog.findMany({ where: { entityType: "Company", entityId: c.id }, orderBy: { createdAt: "desc" }, take: 20, include: { actor: { select: { name: true } } } }),
  ]);
  const verified = new Map(c.verifications.map((v) => [v.field, v]));
  const tag = (field: string) => (verified.has(field) ? <Badge tone="green">vérifié</Badge> : <Badge>déclaré</Badge>);

  return (
    <>
      <nav className="mb-3 text-sm"><Link className="text-brand-700" href="/admin/entreprises">← Entreprises</Link></nav>
      <PageTitle title={c.legalName} subtitle={<>Statut : <strong>{c.status}</strong>{c.statusReason ? ` — ${c.statusReason}` : ""}</>} />
      {c.duplicateFlags.length > 0 && <div className="mb-4"><Alert tone="warn" title="Signaux de doublon">{c.duplicateFlags.join(", ")}{sameSiren.length > 0 && <> — même SIREN : {sameSiren.map((s) => <Link key={s.id} className="underline" href={`/admin/entreprises/${s.id}`}> {s.legalName} ({s.siret})</Link>)}</>}</Alert></div>}
      {!rec.ok && <div className="mb-4"><Alert tone="error">Incohérence : registre {rec.ledger} ≠ solde {rec.wallet}.</Alert></div>}

      <section className="card mb-6">
        <h2 className="mb-3 font-bold">Décision</h2>
        <CompanyActions companyId={c.id} status={c.status} />
        <p className="mt-3 text-sm text-ink-mute">Crédits de découverte pour le SIREN {c.siren} : {welcome ? `déjà attribués (${dateFr(welcome.createdAt)}, entreprise ${welcome.companyId === c.id ? "actuelle" : welcome.companyId})` : "jamais attribués"}.</p>
        <p className="mt-1 text-sm text-ink-mute">Vérifiez l&apos;existence et l&apos;activité de l&apos;entreprise (par ex. annuaire-entreprises.data.gouv.fr) avant validation.</p>
      </section>

      <section className="card mb-6">
        <h2 className="mb-3 font-bold">Informations (déclarées / vérifiées)</h2>
        <DL items={[
          ["SIRET", <>{c.siret} {tag("SIRET")}</>],
          ["Raison sociale / nom commercial", <>{c.legalName}{c.tradeName ? ` / ${c.tradeName}` : ""} {tag("IDENTITY")}</>],
          ["Téléphone", <>{c.phone} {tag("PHONE")}</>],
          ["Email", <>{c.email} {tag("EMAIL")}</>],
          ["Adresse", <>{c.addressLine}, {c.postalCode} {c.city} {tag("ADDRESS")}</>],
          ["TVA", c.vatNumber],
          ["Tailles", c.skipSizesM3.map((s) => `${s} m³`).join(", ")],
          ["Déchets", c.wasteTypes.map(wasteLabel).join(", ")],
          ["Services", c.services.map(serviceLabel).join(", ") || "—"],
          ["Zones", c.zones.map((z) => z.postalCode ?? departmentName(z.departmentCode)).join(", ")],
          ["Horaires / disponibilité déclarée", `${c.openingHours ?? "—"} / ${c.availabilityNote ?? "—"}`],
          ["Facturation", `${c.billingName ?? "—"} · ${c.billingEmail ?? "—"} · ${c.billingAddress ?? ""} ${c.billingPostalCode ?? ""} ${c.billingCity ?? ""}`],
          ["Établissements", c.establishments.map((e) => `${e.name} (${e.city})`).join(", ")],
          ["Utilisateurs", c.members.map((m) => `${m.user.name} <${m.user.email}> ${m.role}`).join(" · ")],
        ]} />
        <div className="mt-4"><VerifyFieldForm companyId={c.id} /></div>
        {c.verifications.length > 0 && <ul className="mt-3 text-sm text-ink-soft">{c.verifications.map((v) => <li key={v.id}>✔ {v.field} — {v.method} ({dateFr(v.verifiedAt)})</li>)}</ul>}
      </section>

      <section className="card mb-6">
        <h2 className="mb-1 font-bold">Crédits — solde {c.wallet?.balance ?? 0}</h2>
        <AdjustCreditsForm companyId={c.id} />
        <table className="table mt-4">
          <thead><tr><th>Date</th><th>Type</th><th>Montant</th><th>Solde</th><th>Motif</th><th>Référence</th></tr></thead>
          <tbody>{c.ledger.map((l) => <tr key={l.id}><td>{dateFr(l.createdAt, true)}</td><td>{l.type}</td><td>{l.amount}</td><td>{l.balanceAfter}</td><td>{l.reason}</td><td className="font-mono text-xs">{l.reference}</td></tr>)}</tbody>
        </table>
      </section>

      <section className="card mb-6">
        <h2 className="mb-2 font-bold">Achats</h2>
        <table className="table"><tbody>{c.purchases.map((p) => <tr key={p.id}><td>{dateFr(p.createdAt)}</td><td>{p.credits} cr.</td><td>{euros(p.priceTtcCents)} TTC</td><td>{p.status}</td><td>{p.needsAdminReview && <Badge tone="red">examen</Badge>}</td></tr>)}</tbody></table>
      </section>

      <section className="card">
        <h2 className="mb-2 font-bold">Journal d&apos;audit</h2>
        <ul className="text-sm">{audits.map((a) => <li key={a.id}>{dateFr(a.createdAt, true)} — {a.action} {a.actor ? `par ${a.actor.name}` : `(${a.actorType})`}</li>)}</ul>
      </section>
    </>
  );
}
