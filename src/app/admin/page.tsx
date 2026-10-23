import Link from "next/link";
import { PageTitle, Stat, Alert } from "@/components/ui";
import { adminMetrics } from "@/lib/metrics";
import { euros } from "@/lib/money";
import { departmentName } from "@/lib/geo";
import { integrationStatuses } from "@/lib/integrations";
import { getSettings, sellerComplete } from "@/lib/settings";

type Props = { searchParams: Promise<{ jours?: string }> };

const hours = (h: number | null) => (h == null ? "—" : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} j`);

export default async function AdminHome({ searchParams }: Props) {
  const days = Math.min(365, Math.max(1, Number((await searchParams).jours) || 30));
  const [m, settings] = await Promise.all([adminMetrics(days), getSettings()]);
  const missing = integrationStatuses().filter((i) => i.required && !i.configured);
  return (
    <>
      <PageTitle title="Tableau de bord" subtitle={`Période : ${days} derniers jours (hors données de démonstration)`} actions={
        <div className="flex gap-1">{[7, 30, 90, 365].map((d) => <Link key={d} className={`btn-sm ${d === days ? "btn-primary" : "btn-secondary"}`} href={`/admin?jours=${d}`}>{d} j</Link>)}</div>
      } />
      <div className="mb-6 space-y-2">
        {missing.length > 0 && <Alert tone="error" title="Intégrations requises manquantes">{missing.map((i) => i.label).join(", ")}. <Link className="underline" href="/admin/integrations">Détails</Link></Alert>}
        {!sellerComplete(settings.seller) && <Alert tone="warn" title="Identité de l'exploitant non renseignée">Les factures ne peuvent pas être émises. <Link className="underline" href="/admin/parametres">Compléter</Link></Alert>}
        {!settings.commercialPolicyValidated && <Alert tone="warn">Politique commerciale (restitutions, remboursements) non validée. À compléter avant mise en production.</Alert>}
        {(m.todo.pendingCompanies > 0 || m.todo.openClaims > 0 || m.todo.reviewPurchases > 0 || m.todo.failedNotifs > 0) && (
          <Alert tone="info" title="À traiter">
            <Link className="underline" href="/admin/entreprises?statut=PENDING">{m.todo.pendingCompanies} entreprise(s) à valider</Link> ·{" "}
            <Link className="underline" href="/admin/signalements">{m.todo.openClaims} signalement(s)</Link> ·{" "}
            <Link className="underline" href="/admin/paiements?revue=1">{m.todo.reviewPurchases} paiement(s) à examiner</Link> ·{" "}
            <Link className="underline" href="/admin/notifications">{m.todo.failedNotifs} notification(s) en échec</Link>
          </Alert>
        )}
      </div>

      <h2 className="mb-2 font-bold">Activité de mise en relation</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Demandes vérifiées diffusées" value={m.published} />
        <Stat label="Contacts débloqués" value={m.unlocks} hint={`${m.creditsConsumed} crédit(s) consommé(s)`} />
        <Stat label="Sans déblocage après 48 h" value={m.requestsWithoutUnlock48h} />
        <Stat label="Taux de restitution" value={`${(m.restitutionRate * 100).toFixed(1)} %`} hint={`${m.claimsAccepted} / ${m.unlocks} déblocages`} />
        <Stat label="Délai moyen avant 1er déblocage" value={hours(m.avgHoursToFirstUnlock)} />
        <Stat label="Délai moyen avant 1re offre enregistrée" value={hours(m.avgHoursToFirstOffer)} />
        <Stat label="Signalements" value={m.claims} />
      </div>

      <h2 className="mb-2 mt-8 font-bold">Revenus de la plateforme (packs de crédits)</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Packs vendus" value={m.packsSold} hint={`${m.creditsSold} crédits`} />
        <Stat label="Ventes HT" value={euros(m.revenueHtCents)} />
        <Stat label="Encaissé TTC net" value={euros(m.revenueTtcCollectedCents)} hint={`Remboursé : ${euros(m.refundedCents)}`} />
      </div>
      <p className="mt-2 text-xs text-ink-mute">Les revenus encaissés ne correspondent ni aux crédits consommés, ni au chiffre d&apos;affaires des locations, que la plateforme ne connaît pas (paiement direct entre client et loueur).</p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-bold">Demandes vérifiées par zone</h2>
          <table className="table"><tbody>{m.verifiedRequestsByZone.map((z) => <tr key={z.dep}><td>{departmentName(z.dep)} ({z.dep})</td><td className="text-right">{z.count}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h2 className="mb-2 font-bold">Solde de crédits par entreprise</h2>
          <table className="table"><tbody>{m.balances.map((b) => <tr key={b.companyId}><td><Link className="text-brand-700" href={`/admin/entreprises/${b.companyId}`}>{b.name}</Link></td><td className="text-right">{b.balance}</td></tr>)}</tbody></table>
        </div>
      </div>
    </>
  );
}
