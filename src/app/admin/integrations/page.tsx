import { PageTitle, Badge, Alert } from "@/components/ui";
import { integrationStatuses } from "@/lib/integrations";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";

export default async function AdminIntegrations() {
  const statuses = integrationStatuses();
  // « Configuré » ≠ « fonctionne » : on affiche aussi la dernière preuve d'usage réel.
  const [lastEmail, lastSms, lastPush, lastStripe] = await Promise.all([
    prisma.notification.findFirst({ where: { channel: "EMAIL", status: "SENT" }, orderBy: { sentAt: "desc" } }),
    prisma.notification.findFirst({ where: { channel: "SMS", status: "SENT" }, orderBy: { sentAt: "desc" } }),
    prisma.notification.findFirst({ where: { channel: "PUSH", status: "SENT" }, orderBy: { sentAt: "desc" } }),
    prisma.stripeEvent.findFirst({ orderBy: { processedAt: "desc" } }),
  ]);
  const proof: Record<string, string> = {
    email: lastEmail ? `Dernier envoi réussi : ${dateFr(lastEmail.sentAt, true)}` : "Aucun envoi réussi enregistré",
    sms: lastSms ? `Dernier envoi réussi : ${dateFr(lastSms.sentAt, true)}` : "Aucun envoi réussi enregistré",
    push: lastPush ? `Dernier envoi réussi : ${dateFr(lastPush.sentAt, true)}` : "Aucun envoi réussi enregistré",
    stripe: lastStripe ? `Dernier webhook reçu : ${dateFr(lastStripe.processedAt, true)} (${lastStripe.type})` : "Aucun webhook reçu",
  };
  return (
    <>
      <PageTitle title="Intégrations externes" subtitle="Les variables sont lues côté serveur ; aucun secret n'est affiché." />
      <div className="mb-4"><Alert tone="info">« Configuré » signifie que les variables sont présentes. Seul un usage réel réussi (colonne de droite) prouve que l&apos;intégration fonctionne.</Alert></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="table">
          <thead><tr><th>Service</th><th>État</th><th>Détail</th><th>Preuve d&apos;usage</th></tr></thead>
          <tbody>{statuses.map((s) => (
            <tr key={s.key}>
              <td className="font-medium">{s.label}{s.required && <span className="text-red-700"> *</span>}</td>
              <td>{s.configured ? <Badge tone="green">Configuré</Badge> : <Badge tone={s.required ? "red" : "amber"}>Non configuré</Badge>}</td>
              <td className="text-sm">{s.detail}</td>
              <td className="text-sm text-ink-soft">{proof[s.key] ?? "—"}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-mute">* requis pour une mise en production. Voir README, section « Services externes ».</p>
    </>
  );
}
