import Link from "next/link";
import { PageTitle, Empty, Badge } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { dateFr, REQUEST_STATUS } from "@/lib/format";
import { wasteLabel } from "@/lib/catalog";

export default async function ContactsPage() {
  const { company } = await requirePageProvider("/loueur/contacts");
  const unlocks = await prisma.unlock.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { name: true } },
      claims: { select: { status: true } },
      request: { select: { id: true, publicRef: true, city: true, status: true, wasteTypes: true, startDate: true, contactName: true, _count: { select: { offers: { where: { companyId: company.id } } } } } },
    },
  });
  return (
    <>
      <PageTitle title="Contacts débloqués" subtitle="Accessibles à tous les utilisateurs de l'entreprise, sans nouveau débit." />
      {unlocks.length === 0 ? <Empty>Aucun contact débloqué.</Empty> : (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-black/[0.04]">
          <table className="table">
            <thead><tr><th>Débloqué le</th><th>Demande</th><th>Client</th><th>Statut</th><th>Offres</th><th>Par</th></tr></thead>
            <tbody>
              {unlocks.map((u) => (
                <tr key={u.id}>
                  <td className="whitespace-nowrap">{dateFr(u.createdAt)}</td>
                  <td><Link className="font-medium text-brand-700" href={`/loueur/demandes/${u.request.id}`}>{u.request.publicRef}</Link><div className="text-xs text-ink-mute">{u.request.city} · {u.request.wasteTypes.map(wasteLabel).join(", ")}</div></td>
                  <td>{u.request.contactName}</td>
                  <td><Badge tone={REQUEST_STATUS[u.request.status].tone}>{REQUEST_STATUS[u.request.status].label}</Badge>{u.claims[0] && <div className="mt-1 text-xs">Signalement : {u.claims[0].status}</div>}</td>
                  <td>{u.request._count.offers}</td>
                  <td className="text-ink-soft">{u.user.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
