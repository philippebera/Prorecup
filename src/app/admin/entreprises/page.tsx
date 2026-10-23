import Link from "next/link";
import { PageTitle, Badge, Empty } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";

type Props = { searchParams: Promise<{ statut?: string; q?: string }> };
const STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" }> = {
  PENDING: { label: "À valider", tone: "amber" }, APPROVED: { label: "Validée", tone: "green" }, SUSPENDED: { label: "Suspendue", tone: "red" }, REJECTED: { label: "Refusée", tone: "gray" },
};

export default async function AdminEntreprises({ searchParams }: Props) {
  const { statut, q } = await searchParams;
  const companies = await prisma.company.findMany({
    where: {
      ...(statut && statut in STATUS ? { status: statut as "PENDING" } : {}),
      ...(q ? { OR: [{ legalName: { contains: q, mode: "insensitive" } }, { siret: { contains: q.replace(/\s/g, "") } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { wallet: true, _count: { select: { unlocks: true, members: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return (
    <>
      <PageTitle title="Entreprises" actions={
        <form className="flex gap-2"><input name="q" defaultValue={q} className="input" placeholder="Nom, SIRET, email" /><button className="btn-secondary btn-sm">Rechercher</button></form>
      } />
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        <Link className="btn-secondary btn-sm" href="/admin/entreprises">Toutes</Link>
        {Object.entries(STATUS).map(([k, v]) => <Link key={k} className="btn-secondary btn-sm" href={`/admin/entreprises?statut=${k}`}>{v.label}</Link>)}
      </div>
      {companies.length === 0 ? <Empty>Aucune entreprise.</Empty> : (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-black/[0.04]">
          <table className="table">
            <thead><tr><th>Entreprise</th><th>SIRET</th><th>Statut</th><th>Signaux</th><th>Crédits</th><th>Déblocages</th><th>Inscrite le</th></tr></thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id}>
                  <td><Link className="font-medium text-brand-700" href={`/admin/entreprises/${c.id}`}>{c.legalName}</Link>{c.isDemo && <Badge tone="blue">démo</Badge>}<div className="text-xs text-ink-mute">{c.city} · {c._count.members} utilisateur(s)</div></td>
                  <td className="font-mono text-xs">{c.siret}</td>
                  <td><Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge></td>
                  <td>{c.duplicateFlags.map((f) => <Badge key={f} tone="red">{f}</Badge>)}</td>
                  <td>{c.wallet?.balance ?? 0}</td>
                  <td>{c._count.unlocks}</td>
                  <td>{dateFr(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
