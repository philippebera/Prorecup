import Link from "next/link";
import { PageTitle, Badge, Empty } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { CLAIM_REASONS } from "@/lib/claims";
import { ResolveClaimForm, ResolveReportForm } from "../forms";

export default async function AdminSignalements() {
  const [claims, closedClaims, reports] = await Promise.all([
    prisma.claim.findMany({ where: { status: "OPEN" }, include: { company: { select: { id: true, legalName: true } }, request: { select: { id: true, publicRef: true, status: true, emailVerifiedAt: true, phoneVerifiedAt: true } }, unlock: true }, orderBy: { createdAt: "asc" } }),
    prisma.claim.findMany({ where: { status: { not: "OPEN" } }, include: { company: { select: { legalName: true } }, request: { select: { publicRef: true } } }, orderBy: { resolvedAt: "desc" }, take: 30 }),
    prisma.clientReport.findMany({ where: { status: "OPEN" }, include: { request: { select: { id: true, publicRef: true } } }, orderBy: { createdAt: "asc" } }),
  ]);
  const label = (c: string) => CLAIM_REASONS.find((r) => r.code === c)?.label ?? c;
  return (
    <>
      <PageTitle title="Signalements" subtitle="Restitution d'un crédit (≠ remboursement monétaire). Un refus de devis, un concurrent choisi ou l'absence de location ne donnent pas droit à restitution." />
      <h2 className="mb-2 font-bold">Réclamations des loueurs ({claims.length})</h2>
      {claims.length === 0 ? <Empty>Aucune réclamation ouverte.</Empty> : (
        <div className="space-y-3">
          {claims.map((c) => (
            <div key={c.id} className="card">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold"><Link className="underline" href={`/admin/entreprises/${c.company.id}`}>{c.company.legalName}</Link> — <Link className="underline" href={`/admin/demandes/${c.request.id}`}>{c.request.publicRef}</Link></p>
                <Badge tone="amber">{label(c.reason)}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink-mute">Déblocage le {dateFr(c.unlock.createdAt, true)} · signalé le {dateFr(c.createdAt, true)} · demande {c.request.status} · email {c.request.emailVerifiedAt ? "vérifié" : "non vérifié"}, tél. {c.request.phoneVerifiedAt ? "vérifié" : "non vérifié"}</p>
              <p className="mt-2 whitespace-pre-line text-sm">{c.details}</p>
              <div className="mt-3"><ResolveClaimForm claimId={c.id} /></div>
            </div>
          ))}
        </div>
      )}
      <h2 className="mb-2 mt-8 font-bold">Signalements des clients ({reports.length})</h2>
      {reports.length === 0 ? <Empty>Aucun signalement client ouvert.</Empty> : (
        <div className="space-y-3">
          {reports.map((r) => (
            <div key={r.id} className="card">
              <p className="font-semibold"><Link className="underline" href={`/admin/demandes/${r.request.id}`}>{r.request.publicRef}</Link> — {r.reason}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{r.message}</p>
              <div className="mt-2"><ResolveReportForm reportId={r.id} /></div>
            </div>
          ))}
        </div>
      )}
      <h2 className="mb-2 mt-8 font-bold">Décisions récentes</h2>
      <ul className="text-sm">{closedClaims.map((c) => <li key={c.id}>{dateFr(c.resolvedAt)} — {c.company.legalName} / {c.request.publicRef} — {c.status === "ACCEPTED" ? "crédit restitué" : "refusé"} — {c.resolution}</li>)}</ul>
    </>
  );
}
