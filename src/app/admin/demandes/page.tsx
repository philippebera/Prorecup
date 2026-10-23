import Link from "next/link";
import { PageTitle, Badge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { REQUEST_STATUS, dateFr } from "@/lib/format";
import { wasteLabel } from "@/lib/catalog";

type Props = { searchParams: Promise<{ statut?: string; q?: string }> };

export default async function AdminDemandes({ searchParams }: Props) {
  const { statut, q } = await searchParams;
  const rows = await prisma.request.findMany({
    where: { ...(statut && statut in REQUEST_STATUS ? { status: statut as "PUBLISHED" } : {}), ...(q ? { OR: [{ publicRef: { contains: q.toUpperCase() } }, { city: { contains: q, mode: "insensitive" } }] } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { id: true, publicRef: true, status: true, city: true, departmentCode: true, wasteTypes: true, unlockCount: true, maxUnlocks: true, createdAt: true, publishedAt: true, isDemo: true, _count: { select: { offers: true, recipients: true, claims: true, reports: true } } },
  });
  return (
    <>
      <PageTitle title="Demandes" actions={<form className="flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="Référence ou commune" /><button className="btn-secondary btn-sm">Rechercher</button></form>} />
      <div className="mb-4 flex flex-wrap gap-2">{Object.entries(REQUEST_STATUS).map(([k, v]) => <Link key={k} className="btn-secondary btn-sm" href={`/admin/demandes?statut=${k}`}>{v.label}</Link>)}</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="table">
          <thead><tr><th>Réf.</th><th>Statut</th><th>Zone</th><th>Déchets</th><th>Destinataires</th><th>Déblocages</th><th>Offres</th><th>Signal.</th><th>Créée</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><Link className="font-medium text-brand-700" href={`/admin/demandes/${r.id}`}>{r.publicRef}</Link>{r.isDemo && <Badge tone="blue">démo</Badge>}</td>
                <td><Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge></td>
                <td>{r.city} ({r.departmentCode})</td>
                <td className="text-xs">{r.wasteTypes.map(wasteLabel).join(", ")}</td>
                <td>{r._count.recipients}</td>
                <td>{r.unlockCount}/{r.maxUnlocks}</td>
                <td>{r._count.offers}</td>
                <td>{r._count.claims + r._count.reports}</td>
                <td>{dateFr(r.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
