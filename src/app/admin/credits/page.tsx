import Link from "next/link";
import { PageTitle } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";

type Props = { searchParams: Promise<{ type?: string }> };
const TYPES = ["WELCOME", "PURCHASE", "UNLOCK", "RESTITUTION", "ADMIN_ADJUSTMENT", "PAYMENT_REVERSAL"];

export default async function AdminCredits({ searchParams }: Props) {
  const { type } = await searchParams;
  const [entries, totals] = await Promise.all([
    prisma.creditLedgerEntry.findMany({ where: type && TYPES.includes(type) ? { type: type as "UNLOCK" } : {}, include: { company: { select: { id: true, legalName: true } } }, orderBy: { createdAt: "desc" }, take: 300 }),
    prisma.creditLedgerEntry.groupBy({ by: ["type"], _sum: { amount: true }, _count: true }),
  ]);
  return (
    <>
      <PageTitle title="Registre des crédits" subtitle="Écriture seule : chaque mouvement a une référence unique. Les ajustements se font depuis la fiche entreprise." />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-6">
        {totals.map((t) => <Link key={t.type} href={`/admin/credits?type=${t.type}`} className="card p-3 text-sm"><span className="block text-ink-mute">{t.type}</span><strong>{t._sum.amount}</strong> ({t._count})</Link>)}
      </div>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-black/[0.04]">
        <table className="table">
          <thead><tr><th>Date</th><th>Entreprise</th><th>Type</th><th>Montant</th><th>Solde</th><th>Motif</th><th>Référence</th></tr></thead>
          <tbody>{entries.map((e) => (
            <tr key={e.id}><td className="whitespace-nowrap">{dateFr(e.createdAt, true)}</td><td><Link className="text-brand-700" href={`/admin/entreprises/${e.company.id}`}>{e.company.legalName}</Link></td><td>{e.type}</td><td>{e.amount}</td><td>{e.balanceAfter}</td><td>{e.reason}</td><td className="font-mono text-xs">{e.reference}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
