import type Stripe from "stripe";
import { prisma, type Tx } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { getStripe } from "./stripe";
import { getSettings } from "./settings";
import { vatFromHt } from "./money";
import { applyLedger, getBalance } from "./credits";
import { issueCreditNote, issueInvoice } from "./invoices";
import { audit } from "./audit";
import { APP_URL } from "./brand";
import { notifyCompany } from "./notifications/queue";

/** Prix d'un pack calculé côté serveur, à partir des packs autorisés en base. */
export async function quotePack(packId: string) {
  const pack = await prisma.creditPack.findUnique({ where: { id: packId } });
  if (!pack || !pack.active) throw notFound("Pack");
  const settings = await getSettings();
  const { ht, vat, ttc } = vatFromHt(pack.priceHtCents, settings.vatRateBp);
  return { pack, ht, vat, ttc, vatRateBp: settings.vatRateBp, unitHt: Math.round(ht / pack.credits), unitTtc: Math.round(ttc / pack.credits) };
}

/**
 * Crée une session Stripe Checkout. Le navigateur n'envoie que l'identifiant du pack ;
 * le montant est recalculé ici. Aucun crédit n'est ajouté à ce stade.
 */
export async function createCheckout(params: { companyId: string; userId: string; packId: string; returnTo?: string }) {
  const company = await prisma.company.findUnique({ where: { id: params.companyId } });
  if (!company) throw notFound("Entreprise");
  if (company.status !== "APPROVED") throw forbidden("Votre entreprise doit être validée avant tout achat de crédits");
  const q = await quotePack(params.packId);
  const stripe = getStripe();

  const purchase = await prisma.purchase.create({
    data: {
      companyId: company.id, userId: params.userId, packId: q.pack.id, credits: q.pack.credits,
      priceHtCents: q.ht, vatRateBp: q.vatRateBp, vatCents: q.vat, priceTtcCents: q.ttc,
    },
  });
  const back = params.returnTo && /^\/loueur\/[a-zA-Z0-9/_-]*$/.test(params.returnTo) ? params.returnTo : "/loueur/portefeuille";
  const methods = (process.env.STRIPE_PAYMENT_METHODS || "card").split(",").map((s) => s.trim()).filter(Boolean) as Stripe.Checkout.SessionCreateParams.AllowedPaymentMethodType[];

  const session = await stripe.checkout.sessions
    .create(
    {
      mode: "payment",
      // Filtre sur les moyens de paiement éligibles (paramètre de l'API Stripe récente).
      allowed_payment_method_types: methods,
      client_reference_id: purchase.id,
      customer_email: company.stripeCustomerId ? undefined : company.billingEmail || company.email,
      customer: company.stripeCustomerId || undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: q.ttc,
            product_data: { name: `${q.pack.name} — ${q.pack.credits} crédits`, description: "Crédits de mise en relation (hors location de benne)" },
          },
        },
      ],
      metadata: { purchaseId: purchase.id, companyId: company.id },
      payment_intent_data: { metadata: { purchaseId: purchase.id, companyId: company.id } },
      success_url: `${APP_URL}${back}?achat=${purchase.id}`,
      cancel_url: `${APP_URL}${back}?achat_annule=${purchase.id}`,
      locale: "fr",
    },
    { idempotencyKey: `checkout:${purchase.id}` },
    )
    .catch(async (e: Error) => {
      await prisma.purchase.update({ where: { id: purchase.id }, data: { status: "FAILED", failureReason: `Création Checkout : ${e.message}`.slice(0, 300) } });
      console.error("Stripe Checkout", e.message);
      throw new AppError("STRIPE_ERROR", "Le service de paiement est indisponible pour le moment. Aucun montant n'a été débité.", 502);
    });
  await prisma.purchase.update({ where: { id: purchase.id }, data: { stripeCheckoutId: session.id } });
  await audit({ actorUserId: params.userId, actorType: "PROVIDER", action: "CHECKOUT_CREATED", entityType: "Purchase", entityId: purchase.id, data: { pack: q.pack.code, ttc: q.ttc } });
  return { url: session.url!, purchaseId: purchase.id };
}

async function grantPurchase(tx: Tx, purchaseId: string, sessionAmount: number | null, currency: string | null, paymentIntentId: string | null) {
  await tx.$queryRaw`SELECT id FROM "Purchase" WHERE id = ${purchaseId} FOR UPDATE`;
  const p = await tx.purchase.findUnique({ where: { id: purchaseId } });
  if (!p) return "unknown-purchase";
  if (p.creditsGrantedAt) return "already-granted";
  if (sessionAmount !== p.priceTtcCents || (currency ?? "eur") !== p.currency) {
    await tx.purchase.update({ where: { id: p.id }, data: { needsAdminReview: true, adminReviewNote: `Montant inattendu : ${sessionAmount} ${currency}` } });
    return "amount-mismatch";
  }
  await applyLedger(tx, {
    companyId: p.companyId, type: "PURCHASE", amount: p.credits, reference: `purchase:${p.id}`,
    reason: `Achat de ${p.credits} crédits`, purchaseId: p.id,
  });
  await tx.purchase.update({
    where: { id: p.id },
    data: { status: "PAID", paidAt: new Date(), creditsGrantedAt: new Date(), stripePaymentIntentId: paymentIntentId ?? p.stripePaymentIntentId },
  });
  await issueInvoice(tx, p.id);
  await notifyCompany(tx, p.companyId, {
    kind: "CREDITS_ADDED", key: `credits:${p.id}`, title: "Crédits ajoutés", body: `${p.credits} crédits ont été ajoutés à votre portefeuille.`, link: "/loueur/portefeuille",
  });
  return "granted";
}

/** Retire des crédits suite à un remboursement/contestation, sans rendre le solde négatif. */
async function reverseCredits(tx: Tx, purchaseId: string, credits: number, reference: string, reason: string) {
  const p = await tx.purchase.findUniqueOrThrow({ where: { id: purchaseId } });
  const remainingToReverse = Math.max(0, Math.min(credits, p.credits - p.creditsReversed));
  if (!remainingToReverse) return { reversed: 0, shortfall: 0 };
  const balance = await getBalance(p.companyId, tx);
  const reversed = Math.min(remainingToReverse, balance);
  if (reversed > 0) {
    const res = await applyLedger(tx, { companyId: p.companyId, type: "PAYMENT_REVERSAL", amount: -reversed, reference, reason, purchaseId });
    if (res.duplicate) return { reversed: 0, shortfall: 0 };
    await tx.purchase.update({ where: { id: purchaseId }, data: { creditsReversed: { increment: reversed } } });
  }
  const shortfall = remainingToReverse - reversed;
  if (shortfall > 0) {
    await tx.purchase.update({
      where: { id: purchaseId },
      data: { needsAdminReview: true, adminReviewNote: `${shortfall} crédit(s) déjà consommé(s) n'ont pas pu être annulés : examen administrateur requis.` },
    });
  }
  return { reversed, shortfall };
}

async function purchaseFromCharge(tx: Tx, charge: Stripe.Charge) {
  const pi = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
  const byMeta = charge.metadata?.purchaseId;
  return tx.purchase.findFirst({ where: { OR: [...(pi ? [{ stripePaymentIntentId: pi }] : []), ...(byMeta ? [{ id: byMeta }] : [])] } });
}

/**
 * Traitement idempotent d'un événement Stripe vérifié.
 * L'identifiant d'événement est enregistré dans la même transaction que ses effets :
 * un événement rejoué (ou reçu en parallèle) ne produit aucun effet supplémentaire.
 */
export async function handleStripeEvent(event: Stripe.Event) {
  return prisma.$transaction(
    async (tx) => {
      const inserted = await tx.$executeRaw`INSERT INTO "StripeEvent" ("id", "type", "processedAt") VALUES (${event.id}, ${event.type}, now()) ON CONFLICT DO NOTHING`;
      if (inserted === 0) return "duplicate-event";
      let outcome = "ignored";

      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded": {
          const s = event.data.object as Stripe.Checkout.Session;
          const purchaseId = s.metadata?.purchaseId || s.client_reference_id;
          const p = purchaseId ? await tx.purchase.findUnique({ where: { id: purchaseId } }) : null;
          if (!p || (p.stripeCheckoutId && p.stripeCheckoutId !== s.id)) {
            outcome = "unknown-purchase";
            break;
          }
          const pi = typeof s.payment_intent === "string" ? s.payment_intent : (s.payment_intent?.id ?? null);
          if (s.payment_status === "paid" || s.payment_status === "no_payment_required") {
            outcome = await grantPurchase(tx, p.id, s.amount_total, s.currency, pi);
          } else {
            await tx.purchase.update({ where: { id: p.id }, data: { status: "PROCESSING", stripePaymentIntentId: pi } });
            outcome = "processing";
          }
          break;
        }
        case "checkout.session.async_payment_failed": {
          const s = event.data.object as Stripe.Checkout.Session;
          const purchaseId = s.metadata?.purchaseId || s.client_reference_id;
          if (purchaseId) {
            await tx.purchase.updateMany({ where: { id: purchaseId, creditsGrantedAt: null }, data: { status: "FAILED", failureReason: "Paiement différé refusé" } });
            const p = await tx.purchase.findUnique({ where: { id: purchaseId } });
            if (p) await notifyCompany(tx, p.companyId, { kind: "PAYMENT_FAILED", key: `payfail:${p.id}`, title: "Paiement refusé", body: "Le paiement de votre pack n'a pas abouti. Aucun crédit n'a été ajouté.", link: "/loueur/portefeuille" });
          }
          outcome = "failed";
          break;
        }
        case "checkout.session.expired": {
          const s = event.data.object as Stripe.Checkout.Session;
          const purchaseId = s.metadata?.purchaseId || s.client_reference_id;
          if (purchaseId) await tx.purchase.updateMany({ where: { id: purchaseId, status: "PENDING" }, data: { status: "EXPIRED" } });
          outcome = "expired";
          break;
        }
        case "payment_intent.payment_failed": {
          const pi = event.data.object as Stripe.PaymentIntent;
          const purchaseId = pi.metadata?.purchaseId;
          if (purchaseId)
            await tx.purchase.updateMany({ where: { id: purchaseId, creditsGrantedAt: null }, data: { failureReason: pi.last_payment_error?.message?.slice(0, 300) ?? "Paiement refusé" } });
          outcome = "attempt-failed";
          break;
        }
        case "charge.succeeded": {
          const ch = event.data.object as Stripe.Charge;
          const p = await purchaseFromCharge(tx, ch);
          if (p) await tx.purchase.update({ where: { id: p.id }, data: { stripeChargeId: ch.id, receiptUrl: ch.receipt_url ?? p.receiptUrl } });
          outcome = "receipt";
          break;
        }
        case "charge.refunded": {
          const ch = event.data.object as Stripe.Charge;
          const p = await purchaseFromCharge(tx, ch);
          if (!p) {
            outcome = "unknown-purchase";
            break;
          }
          const newlyRefunded = ch.amount_refunded - p.refundedCents;
          if (newlyRefunded <= 0) {
            outcome = "no-change";
            break;
          }
          const full = ch.amount_refunded >= ch.amount;
          // Crédits correspondant au montant remboursé (arrondi supérieur pour un remboursement total).
          const targetReversed = full ? p.credits : Math.floor((p.credits * ch.amount_refunded) / ch.amount);
          const toReverse = targetReversed - p.creditsReversed;
          const r = toReverse > 0 ? await reverseCredits(tx, p.id, toReverse, `refund:${ch.id}:${ch.amount_refunded}`, `Remboursement Stripe ${ch.id}`) : { reversed: 0, shortfall: 0 };
          await tx.purchase.update({ where: { id: p.id }, data: { status: full ? "REFUNDED" : "PARTIALLY_REFUNDED", refundedCents: ch.amount_refunded, stripeChargeId: ch.id } });
          if (p.paidAt) await issueCreditNote(tx, p.id, `${ch.id}:${ch.amount_refunded}`, newlyRefunded, "Remboursement");
          await audit({ actorType: "STRIPE", action: "PURCHASE_REFUNDED", entityType: "Purchase", entityId: p.id, data: { refunded: ch.amount_refunded, ...r } }, tx);
          outcome = `refunded:${r.reversed}:${r.shortfall}`;
          break;
        }
        case "charge.dispute.created": {
          const d = event.data.object as Stripe.Dispute;
          const chargeId = typeof d.charge === "string" ? d.charge : d.charge.id;
          const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
          const p = await tx.purchase.findFirst({ where: { OR: [{ stripeChargeId: chargeId }, ...(pi ? [{ stripePaymentIntentId: pi }] : [])] } });
          if (p) {
            await tx.purchase.update({ where: { id: p.id }, data: { status: "DISPUTED", needsAdminReview: true, adminReviewNote: `Contestation ouverte (${d.reason})` } });
            await audit({ actorType: "STRIPE", action: "PURCHASE_DISPUTED", entityType: "Purchase", entityId: p.id, data: { reason: d.reason } }, tx);
          }
          outcome = "disputed";
          break;
        }
        case "charge.dispute.closed": {
          const d = event.data.object as Stripe.Dispute;
          const chargeId = typeof d.charge === "string" ? d.charge : d.charge.id;
          const pi = typeof d.payment_intent === "string" ? d.payment_intent : d.payment_intent?.id;
          const p = await tx.purchase.findFirst({ where: { OR: [{ stripeChargeId: chargeId }, ...(pi ? [{ stripePaymentIntentId: pi }] : [])] } });
          if (p && d.status === "lost") {
            const r = await reverseCredits(tx, p.id, p.credits, `dispute:${d.id}`, `Contestation perdue ${d.id}`);
            await tx.purchase.update({ where: { id: p.id }, data: { status: "DISPUTE_LOST", needsAdminReview: true } });
            outcome = `dispute-lost:${r.reversed}:${r.shortfall}`;
          } else if (p && d.status === "won") {
            await tx.purchase.update({ where: { id: p.id }, data: { status: "PAID", adminReviewNote: "Contestation gagnée" } });
            outcome = "dispute-won";
          }
          break;
        }
      }
      await tx.stripeEvent.update({ where: { id: event.id }, data: { outcome } });
      return outcome;
    },
    { timeout: 20000 },
  );
}
