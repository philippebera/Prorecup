import Link from "next/link";
import { PageTitle, Badge, Empty } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";

export default async function AdminAbus() {
  const since = new Date(Date.now() - 30 * 86400_000);
  const [flagged, sirenGroups, fpGroups, ipGroups, claimHeavy] = await Promise.all([
    prisma.company.findMany({ where: { duplicateFlags: { isEmpty: false } }, select: { id: true, legalName: true, siret: true, duplicateFlags: true, status: true } }),
    prisma.company.groupBy({ by: ["siren"], _count: true, having: { siren: { _count: { gt: 1 } } } }),
    prisma.request.groupBy({ by: ["fingerprint"], where: { createdAt: { gte: since }, fingerprint: { not: null } }, _count: true, having: { fingerprint: { _count: { gt: 2 } } } }),
    prisma.request.groupBy({ by: ["ipHash"], where: { createdAt: { gte: since }, ipHash: { not: null } }, _count: true, having: { ipHash: { _count: { gt: 5 } } } }),
    prisma.claim.groupBy({ by: ["companyId"], where: { createdAt: { gte: since } }, _count: true, having: { companyId: { _count: { gt: 3 } } } }),
  ]);
  const heavyCompanies = await prisma.company.findMany({ where: { id: { in: claimHeavy.map((c) => c.companyId) } }, select: { id: true, legalName: true } });
  const fpRequests = fpGroups.length ? await prisma.request.findMany({ where: { fingerprint: { in: fpGroups.map((g) => g.fingerprint!) } }, select: { id: true, publicRef: true, fingerprint: true, createdAt: true, status: true }, orderBy: { createdAt: "desc" } }) : [];
  return (
    <>
      <PageTitle title="Doublons et abus" subtitle="Signaux à examiner : aucun n'est une preuve en soi." />
      <section className="card mb-6">
        <h2 className="mb-2 font-bold">Entreprises signalées à l&apos;inscription</h2>
        {flagged.length === 0 ? <Empty>Aucune.</Empty> : <ul className="text-sm">{flagged.map((c) => <li key={c.id}>• <Link className="underline" href={`/admin/entreprises/${c.id}`}>{c.legalName}</Link> ({c.siret}, {c.status}) {c.duplicateFlags.map((f) => <Badge key={f} tone="red">{f}</Badge>)}</li>)}</ul>}
        <p className="mt-2 text-sm text-ink-mute">SIREN avec plusieurs comptes : {sirenGroups.map((g) => `${g.siren} (${g._count})`).join(", ") || "aucun"}. Les crédits de découverte ne sont attribués qu&apos;une fois par SIREN.</p>
      </section>
      <section className="card mb-6">
        <h2 className="mb-2 font-bold">Demandes répétées avec les mêmes coordonnées (30 j, &gt; 2)</h2>
        {fpRequests.length === 0 ? <Empty>Aucune.</Empty> : <ul className="text-sm">{fpRequests.map((r) => <li key={r.id}>• <Link className="underline" href={`/admin/demandes/${r.id}`}>{r.publicRef}</Link> — {dateFr(r.createdAt)} — {r.status} — empreinte {r.fingerprint!.slice(0, 8)}</li>)}</ul>}
      </section>
      <section className="card mb-6">
        <h2 className="mb-2 font-bold">Volume de demandes par adresse IP (30 j, &gt; 5)</h2>
        <p className="text-sm">{ipGroups.map((g) => `${g.ipHash!.slice(0, 10)}… : ${g._count}`).join(" · ") || "Aucun."}</p>
      </section>
      <section className="card">
        <h2 className="mb-2 font-bold">Entreprises avec beaucoup de réclamations (30 j, &gt; 3)</h2>
        <p className="text-sm">{heavyCompanies.map((c) => <Link key={c.id} className="mr-2 underline" href={`/admin/entreprises/${c.id}`}>{c.legalName}</Link>)}{heavyCompanies.length === 0 && "Aucune."}</p>
      </section>
    </>
  );
}
