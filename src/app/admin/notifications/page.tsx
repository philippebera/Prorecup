import { PageTitle, Badge } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { ActionButton } from "@/components/client";

export default async function AdminNotifications() {
  const [byStatus, problems] = await Promise.all([
    prisma.notification.groupBy({ by: ["channel", "status"], _count: true }),
    prisma.notification.findMany({ where: { status: { in: ["FAILED", "SKIPPED_NOT_CONFIGURED", "SKIPPED_CAP"] } }, orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const pending = byStatus.filter((s) => s.status === "PENDING").reduce((a, s) => a + s._count, 0);
  return (
    <>
      <PageTitle title="File de notifications" subtitle={`${pending} en attente d'envoi`} actions={<ActionButton url="/api/admin/notifications" data={{ action: "process" }} label="Traiter la file maintenant" />} />
      <div className="card mb-6 overflow-x-auto">
        <table className="table">
          <thead><tr><th>Canal</th><th>Statut</th><th className="text-right">Nombre</th></tr></thead>
          <tbody>{byStatus.map((s) => <tr key={`${s.channel}-${s.status}`}><td>{s.channel}</td><td>{s.status}</td><td className="text-right">{s._count}</td></tr>)}</tbody>
        </table>
        <p className="mt-2 text-xs text-ink-mute">SKIPPED_NOT_CONFIGURED : aucun envoi n&apos;a eu lieu car le service n&apos;est pas configuré. Rien n&apos;est présenté comme envoyé.</p>
      </div>
      <h2 className="mb-2 font-bold">Échecs et envois non effectués</h2>
      <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-black/[0.04]">
        <table className="table">
          <thead><tr><th>Date</th><th>Canal</th><th>Type</th><th>Statut</th><th>Essais</th><th>Erreur</th><th></th></tr></thead>
          <tbody>{problems.map((n) => (
            <tr key={n.id}>
              <td className="whitespace-nowrap">{dateFr(n.createdAt, true)}</td><td>{n.channel}</td><td>{n.kind}</td>
              <td><Badge tone={n.status === "FAILED" ? "red" : "amber"}>{n.status}</Badge></td><td>{n.attempts}</td>
              <td className="max-w-xs truncate text-xs">{n.lastError}</td>
              <td>{n.status === "FAILED" && <ActionButton url="/api/admin/notifications" data={{ action: "retry", id: n.id }} label="Relancer" />}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
