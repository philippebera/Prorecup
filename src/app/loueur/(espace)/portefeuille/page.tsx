import { PageTitle, Alert, Badge, Empty } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { getBalance } from "@/lib/credits";
import { getSettings } from "@/lib/settings";
import { euros, vatFromHt, vatLabel } from "@/lib/money";
import { dateFr } from "@/lib/format";
import { stripeConfigured, stripeTestMode } from "@/lib/integrations";
import { BuyPackButton } from "./buy";

type Props = { searchParams: Promise<{ achat?: string; achat_annule?: string }> };

const LEDGER_LABEL: Record<string, string> = {
  WELCOME: "Crédits offerts",
  PURCHASE: "Achat",
  UNLOCK: "Contact débloqué",
  RESTITUTION: "Crédit restitué",
  ADMIN_ADJUSTMENT: "Ajustement administratif",
  PAYMENT_REVERSAL: "Annulation (remboursement / contestation)",
};

const PURCHASE_LABEL: Record<string, { label: string; tone: "green" | "gray" | "amber" | "red" | "blue" }> = {
  PENDING: { label: "En attente de paiement", tone: "gray" },
  PROCESSING: { label: "Paiement en cours de confirmation", tone: "amber" },
  PAID: { label: "Payé", tone: "green" },
  FAILED: { label: "Échoué", tone: "red" },
  EXPIRED: { label: "Abandonné", tone: "gray" },
  REFUNDED: { label: "Remboursé", tone: "blue" },
  PARTIALLY_REFUNDED: { label: "Partiellement remboursé", tone: "blue" },
  DISPUTED: { label: "Contesté", tone: "red" },
  DISPUTE_LOST: { label: "Contestation perdue", tone: "red" },
};

export default async function PortefeuillePage({ searchParams }: Props) {
  const { company } = await requirePageProvider("/loueur/portefeuille");
  const { achat, achat_annule } = await searchParams;
  const [balance, settings, packs, ledger, purchases] = await Promise.all([
    getBalance(company.id),
    getSettings(),
    prisma.creditPack.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    prisma.creditLedgerEntry.findMany({ where: { companyId: company.id }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.purchase.findMany({ where: { companyId: company.id, status: { not: "PENDING" } }, include: { invoice: true, creditNotes: true }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const current = achat ? await prisma.purchase.findFirst({ where: { id: achat, companyId: company.id } }) : null;

  return (
    <>
      <PageTitle title="Crédits et factures" subtitle={`Solde de l'entreprise : ${balance} crédit(s). Crédits sans date d'expiration.`} />

      {current && (
        <div className="mb-4">
          {current.status === "PAID" ? <Alert tone="success">Paiement confirmé : {current.credits} crédits ajoutés.</Alert>
            : current.status === "FAILED" || current.status === "EXPIRED" ? <Alert tone="error">Le paiement n&apos;a pas abouti. Aucun crédit n&apos;a été ajouté.</Alert>
            : <Alert tone="info" title="Paiement en cours de confirmation">Les crédits sont ajoutés uniquement après confirmation du paiement par Stripe. Actualisez la page dans quelques instants.</Alert>}
        </div>
      )}
      {achat_annule && <div className="mb-4"><Alert tone="info">Paiement annulé. Aucun crédit n&apos;a été ajouté ni débité.</Alert></div>}
      {!stripeConfigured() && <div className="mb-4"><Alert tone="warn">Le paiement en ligne n&apos;est pas encore configuré sur la plateforme : l&apos;achat de packs est momentanément indisponible.</Alert></div>}
      {stripeConfigured() && stripeTestMode() && <div className="mb-4"><Alert tone="info">Mode test Stripe : aucun paiement réel (carte de test 4242 4242 4242 4242).</Alert></div>}

      <section className="grid gap-3 sm:grid-cols-3">
        {packs.map((p) => {
          const { ht, vat, ttc } = vatFromHt(p.priceHtCents, settings.vatRateBp);
          return (
            <div key={p.id} className="card flex flex-col">
              <div className="flex items-start justify-between">
                <p className="text-6xl font-extrabold leading-none tracking-tight">{p.credits}</p>
                <span className="chip bg-canvas text-ink-soft">{p.name}</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-ink-mute">crédits · sans expiration</p>
              <div className="mt-5 rounded-2xl bg-canvas p-3">
                <p className="text-2xl font-extrabold">{euros(ht)} <span className="text-sm font-semibold text-ink-mute">HT</span></p>
                <p className="text-sm text-ink-soft">{euros(ttc)} TTC · TVA {vatLabel(settings.vatRateBp)} ({euros(vat)})</p>
              </div>
              <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-lime-soft px-3 py-1 text-sm font-semibold text-brand-800">{euros(Math.round(ht / p.credits))} HT / contact <span className="font-normal text-ink-mute">({euros(Math.round(ttc / p.credits))} TTC)</span></p>
              <div className="mt-5 flex-1" />
              <BuyPackButton packId={p.id} disabled={!stripeConfigured() || company.status !== "APPROVED"} />
            </div>
          );
        })}
      </section>
      <p className="mt-3 text-sm text-ink-mute">Sans abonnement ni recharge automatique. 1 crédit = 1 contact débloqué pour votre entreprise. Les prix des locations restent libres et sont réglés directement entre vous et le client : aucune commission.</p>

      <section className="mt-10">
        <h2 className="mb-3 text-lg font-bold">Historique des crédits</h2>
        {ledger.length === 0 ? <Empty>Aucun mouvement.</Empty> : (
          <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-black/[0.04]">
            <table className="table">
              <thead><tr><th>Date</th><th>Opération</th><th>Détail</th><th className="text-right">Crédits</th><th className="text-right">Solde</th><th>Référence</th></tr></thead>
              <tbody>
                {ledger.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap">{dateFr(l.createdAt, true)}</td>
                    <td>{LEDGER_LABEL[l.type]}</td>
                    <td className="text-ink-soft">{l.reason ?? "—"}</td>
                    <td className={`text-right font-semibold ${l.amount > 0 ? "text-brand-700" : "text-red-700"}`}>{l.amount > 0 ? `+${l.amount}` : l.amount}</td>
                    <td className="text-right">{l.balanceAfter}</td>
                    <td className="font-mono text-xs text-ink-mute">{l.id.slice(-10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-1 text-lg font-bold">Achats, justificatifs et factures</h2>
        <p className="mb-3 text-sm text-ink-mute">Le justificatif de paiement est émis par Stripe ; la facture est émise par la plateforme.</p>
        {purchases.length === 0 ? <Empty>Aucun achat.</Empty> : (
          <div className="overflow-x-auto rounded-3xl bg-white shadow-soft ring-1 ring-black/[0.04]">
            <table className="table">
              <thead><tr><th>Date</th><th>Pack</th><th>Montant</th><th>Statut</th><th>Justificatif</th><th>Facture</th></tr></thead>
              <tbody>
                {purchases.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap">{dateFr(p.createdAt)}</td>
                    <td>{p.credits} crédits</td>
                    <td className="whitespace-nowrap">{euros(p.priceHtCents)} HT<br /><span className="text-ink-mute">{euros(p.priceTtcCents)} TTC</span></td>
                    <td><Badge tone={PURCHASE_LABEL[p.status].tone}>{PURCHASE_LABEL[p.status].label}</Badge></td>
                    <td>{p.receiptUrl ? <a className="text-brand-700 underline" href={p.receiptUrl} target="_blank" rel="noreferrer">Reçu Stripe</a> : "—"}</td>
                    <td>
                      {p.invoice ? <a className="text-brand-700 underline" href={`/api/loueur/invoices/${p.invoice.id}`}>{p.invoice.number}</a> : p.paidAt ? <span className="text-ink-mute">En cours d&apos;émission</span> : "—"}
                      {p.creditNotes.map((c) => <div key={c.id} className="text-xs text-ink-mute">Avoir {c.number} : {euros(c.amountTtcCents)}</div>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
