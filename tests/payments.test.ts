import { beforeEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { handleStripeEvent, quotePack } from "@/lib/payments";
import { constructWebhookEvent } from "@/lib/stripe";
import { unlockRequest } from "@/lib/unlock";
import { setSetting } from "@/lib/settings";
import { balance, makeCompany, makePublishedRequest, resetDb } from "./helpers";

beforeEach(resetDb);

const WHSEC = "whsec_test_secret_for_unit_tests";

async function pendingPurchase(companyId: string, userId: string, code = "PACK_5") {
  const pack = await prisma.creditPack.findUniqueOrThrow({ where: { code } });
  const q = await quotePack(pack.id);
  return prisma.purchase.create({
    data: { companyId, userId, packId: pack.id, credits: pack.credits, priceHtCents: q.ht, vatRateBp: q.vatRateBp, vatCents: q.vat, priceTtcCents: q.ttc, stripeCheckoutId: `cs_test_${Math.random().toString(36).slice(2)}` },
  });
}

function sessionEvent(type: string, p: { id: string; stripeCheckoutId: string | null; priceTtcCents: number }, over: Record<string, unknown> = {}, id = `evt_${Math.random().toString(36).slice(2)}`) {
  return {
    id, type, object: "event",
    data: { object: { id: p.stripeCheckoutId, object: "checkout.session", payment_status: "paid", amount_total: p.priceTtcCents, currency: "eur", payment_intent: `pi_${p.id}`, client_reference_id: p.id, metadata: { purchaseId: p.id }, ...over } },
  } as unknown as Stripe.Event;
}

function chargeRefunded(p: { id: string; priceTtcCents: number }, refunded: number, id = `evt_${Math.random().toString(36).slice(2)}`) {
  return {
    id, type: "charge.refunded", object: "event",
    data: { object: { id: `ch_${p.id}`, object: "charge", amount: p.priceTtcCents, amount_refunded: refunded, payment_intent: `pi_${p.id}`, metadata: { purchaseId: p.id } } },
  } as unknown as Stripe.Event;
}

describe("Prix calculés côté serveur", () => {
  it("HT, TVA, TTC et prix unitaire depuis les packs autorisés", async () => {
    const pack = await prisma.creditPack.findUniqueOrThrow({ where: { code: "PACK_15" } });
    const q = await quotePack(pack.id);
    expect(q).toMatchObject({ ht: 12000, vat: 2400, ttc: 14400, unitHt: 800, unitTtc: 960 });
    await setSetting("vatRateBp", 850);
    expect((await quotePack(pack.id)).ttc).toBe(13020);
  });

  it("createCheckout envoie à Stripe le montant serveur et ne crédite rien", async () => {
    const { company, user } = await makeCompany();
    const pack = await prisma.creditPack.findUniqueOrThrow({ where: { code: "PACK_5" } });
    const create = vi.fn(async (_params: Stripe.Checkout.SessionCreateParams) => ({ id: "cs_test_mock", url: "https://checkout.stripe.test/x" }));
    vi.doMock("@/lib/stripe", () => ({ getStripe: () => ({ checkout: { sessions: { create } } }) }));
    vi.resetModules();
    const { createCheckout } = await import("@/lib/payments");
    await createCheckout({ companyId: company.id, userId: user.id, packId: pack.id });
    vi.doUnmock("@/lib/stripe");
    const params = create.mock.calls[0][0];
    expect(params.line_items![0].price_data!.unit_amount).toBe(5400);
    expect(params.metadata!.purchaseId).toBeTruthy();
    expect(await balance(company.id)).toBe(3); // seulement les crédits offerts
  });
});

describe("Webhooks Stripe", () => {
  it("vérifie la signature", () => {
    const payload = JSON.stringify({ id: "evt_sig", object: "event", type: "checkout.session.completed", data: { object: {} } });
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
    expect(constructWebhookEvent(payload, header, WHSEC).id).toBe("evt_sig");
    expect(() => constructWebhookEvent(payload, header, "whsec_autre")).toThrow();
    expect(() => constructWebhookEvent(payload.replace("evt_sig", "evt_x"), header, WHSEC)).toThrow();
    expect(() => constructWebhookEvent(payload, null, WHSEC)).toThrow();
  });

  it("paiement réussi : crédits ajoutés une seule fois, même si le webhook est reçu plusieurs fois", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    const evt = sessionEvent("checkout.session.completed", p);
    expect(await handleStripeEvent(evt)).toBe("granted");
    expect(await handleStripeEvent(evt)).toBe("duplicate-event");
    const results = await Promise.all([handleStripeEvent(evt), handleStripeEvent(evt)]);
    expect(results).toEqual(["duplicate-event", "duplicate-event"]);
    // événement différent pour la même session (ex. async_payment_succeeded)
    expect(await handleStripeEvent(sessionEvent("checkout.session.async_payment_succeeded", p))).toBe("already-granted");
    expect(await balance(company.id)).toBe(8);
    expect(await prisma.creditLedgerEntry.count({ where: { purchaseId: p.id, type: "PURCHASE" } })).toBe(1);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PAID");
  });

  it("événements distincts reçus en parallèle : un seul crédit", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    await Promise.allSettled([handleStripeEvent(sessionEvent("checkout.session.completed", p)), handleStripeEvent(sessionEvent("checkout.session.async_payment_succeeded", p))]);
    expect(await balance(company.id)).toBe(8);
  });

  it("paiement différé : rien avant confirmation, crédits après succès", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    expect(await handleStripeEvent(sessionEvent("checkout.session.completed", p, { payment_status: "unpaid" }))).toBe("processing");
    expect(await balance(company.id)).toBe(3);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("PROCESSING");
    expect(await handleStripeEvent(sessionEvent("checkout.session.async_payment_succeeded", p))).toBe("granted");
    expect(await balance(company.id)).toBe(8);
  });

  it("paiement échoué : aucun crédit", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    await handleStripeEvent(sessionEvent("checkout.session.completed", p, { payment_status: "unpaid" }));
    await handleStripeEvent(sessionEvent("checkout.session.async_payment_failed", p, { payment_status: "unpaid" }));
    expect(await balance(company.id)).toBe(3);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).status).toBe("FAILED");
  });

  it("montant inattendu : aucun crédit et examen administrateur", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    expect(await handleStripeEvent(sessionEvent("checkout.session.completed", p, { amount_total: 100 }))).toBe("amount-mismatch");
    expect(await balance(company.id)).toBe(3);
    expect((await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } })).needsAdminReview).toBe(true);
  });

  it("remboursement total, crédits non utilisés : crédits annulés", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    await handleStripeEvent(sessionEvent("checkout.session.completed", p));
    const refund = chargeRefunded(p, p.priceTtcCents);
    expect(await handleStripeEvent(refund)).toBe("refunded:5:0");
    expect(await handleStripeEvent(refund)).toBe("duplicate-event");
    expect(await balance(company.id)).toBe(3);
    const fresh = await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } });
    expect(fresh.status).toBe("REFUNDED");
    expect(fresh.needsAdminReview).toBe(false);
    expect(await prisma.creditLedgerEntry.count({ where: { purchaseId: p.id, type: "PAYMENT_REVERSAL" } })).toBe(1);
  });

  it("remboursement alors que des crédits ont été consommés : solde jamais négatif, examen administrateur", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    await handleStripeEvent(sessionEvent("checkout.session.completed", p)); // 3 + 5 = 8
    for (let i = 0; i < 6; i++) {
      const { request } = await makePublishedRequest();
      await unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true });
    } // reste 2
    expect(await balance(company.id)).toBe(2);
    expect(await handleStripeEvent(chargeRefunded(p, p.priceTtcCents))).toBe("refunded:2:3");
    expect(await balance(company.id)).toBe(0);
    const fresh = await prisma.purchase.findUniqueOrThrow({ where: { id: p.id } });
    expect(fresh.needsAdminReview).toBe(true);
    expect(fresh.adminReviewNote).toContain("3 crédit");
  });

  it("contestation perdue : crédits annulés et examen", async () => {
    const { company, user } = await makeCompany();
    const p = await pendingPurchase(company.id, user.id);
    await handleStripeEvent(sessionEvent("checkout.session.completed", p));
    const dispute = (status: string) =>
      ({ id: `evt_${status}_${p.id}`, type: status === "open" ? "charge.dispute.created" : "charge.dispute.closed", object: "event", data: { object: { id: `dp_${p.id}`, charge: `ch_${p.id}`, payment_intent: `pi_${p.id}`, status, reason: "fraudulent" } } }) as unknown as Stripe.Event;
    expect(await handleStripeEvent(dispute("open"))).toBe("disputed");
    expect(await handleStripeEvent(dispute("lost"))).toBe("dispute-lost:5:0");
    expect(await balance(company.id)).toBe(3);
  });

  it("facture émise uniquement si l'identité de l'exploitant est renseignée", async () => {
    const { company, user } = await makeCompany();
    const p1 = await pendingPurchase(company.id, user.id);
    await handleStripeEvent(sessionEvent("checkout.session.completed", p1));
    expect(await prisma.invoice.count()).toBe(0);
    await setSetting("seller", { legalName: "Exploitant Test", legalForm: "SAS", address: "1 rue Test, 75001 Paris", siret: "00000000000000", vatNumber: "", rcs: "", capital: "", email: "facturation@test.invalid" });
    const { issuePendingInvoices, invoicePdf } = await import("@/lib/invoices");
    expect(await issuePendingInvoices()).toEqual({ pending: 1, issued: 1 });
    const inv = await prisma.invoice.findFirstOrThrow();
    expect(inv.totalTtcCents).toBe(5400);
    expect(inv.number).toMatch(/^F-\d{4}-00001$/);
    const pdf = await invoicePdf(inv.id, company.id);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect((inv.sellerSnapshot as Prisma.JsonObject).legalName).toBe("Exploitant Test");
  });
});
