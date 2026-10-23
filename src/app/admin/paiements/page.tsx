import Link from "next/link";
import { PageTitle, Badge, Alert } from "@/components/ui";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { euros } from "@/lib/money";
import { ActionButton } from "@/components/client";
import { getSettings, sellerComplete } from "@/lib/settings";
import { PurchaseReviewForm } from "../forms";

type Props = { searchParams: Promise<{ revue?: string }> };

export default async function AdminPaiements({ searchParams }: Props) {
  const { revue } = await searchParams;
  const [purchases, pendingInvoices, settings, events] = await Promise.all([
    prisma.purchase.findMany({ where: revue ? { needsAdminReview: true } : {}, include: { company: { select: { id: true, legalName: true } }, invoice: true, creditNotes: true }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.purchase.count({ where: { paidAt: { not: null }, invoice: null } }),
    getSettings(),
    prisma.stripeEvent.findMany({ orderBy: { processedAt: "desc" }, take: 20 }),
  ]);
  return (
    <>
      <PageTitle title="Paiements (packs de crédits)" actions={<Link className="btn-secondary btn-sm" href={revue ? "/admin/paiements" : "/admin/paiements?revue=1"}>{revue ? "Tous" : "À examiner"}</Link>} />
      {pendingInvoices > 0 && (
        <div className="mb-4">
          <Alert tone="warn" title={`${pendingInvoices} facture(s) à émettre`}>
            {sellerComplete(settings.seller) ? <ActionButton url="/api/admin/invoices" data={{}} label="Émettre les factures en attente" /> : <>Renseignez d&apos;abord l&apos;identité de l&apos;exploitant dans <Link className="underline" href="/admin/parametres">Paramètres</Link>.</>}
          </Alert>
        </div>
      )}
      <div className="space-y-3">
        {purchases.map((p) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p><Link className="font-semibold underline" href={`/admin/entreprises/${p.company.id}`}>{p.company.legalName}</Link> — {p.credits} crédits — {euros(p.priceHtCents)} HT / {euros(p.priceTtcCents)} TTC</p>
              <div className="flex gap-2"><Badge tone={p.status === "PAID" ? "green" : p.status.includes("DISPUTE") || p.status === "FAILED" ? "red" : "gray"}>{p.status}</Badge>{p.needsAdminReview && <Badge tone="red">Examen requis</Badge>}</div>
            </div>
            <p className="mt-1 text-xs text-ink-mute">
              {dateFr(p.createdAt, true)} · Checkout {p.stripeCheckoutId ?? "—"} · PI {p.stripePaymentIntentId ?? "—"} · crédits ajoutés : {p.creditsGrantedAt ? dateFr(p.creditsGrantedAt, true) : "non"} · annulés : {p.creditsReversed} · remboursé : {euros(p.refundedCents)}
              {p.invoice && ` · facture ${p.invoice.number}`}{p.creditNotes.map((c) => ` · avoir ${c.number}`).join("")}
            </p>
            {p.adminReviewNote && <p className="mt-1 whitespace-pre-line text-sm text-amber-800">{p.adminReviewNote}</p>}
            {(p.needsAdminReview || p.status === "PAID") && <div className="mt-2"><PurchaseReviewForm purchaseId={p.id} refundable={p.status === "PAID" && !!p.stripePaymentIntentId} /></div>}
          </div>
        ))}
      </div>
      <h2 className="mb-2 mt-8 font-bold">Derniers webhooks Stripe traités</h2>
      <table className="table"><tbody>{events.map((e) => <tr key={e.id}><td className="font-mono text-xs">{e.id}</td><td>{e.type}</td><td>{e.outcome}</td><td>{dateFr(e.processedAt, true)}</td></tr>)}</tbody></table>
    </>
  );
}
