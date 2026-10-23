import { prisma, type Tx } from "./db";
import { getSettings, sellerComplete } from "./settings";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { euros, vatLabel } from "./money";
import { AppError, notFound } from "./errors";
import { BRAND_NAME } from "./brand";

async function nextNumber(tx: Tx, prefix: string) {
  const year = new Date().getFullYear();
  const key = `${prefix}-${year}`;
  const [row] = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "DocumentCounter" ("key", "value") VALUES (${key}, 1)
    ON CONFLICT ("key") DO UPDATE SET "value" = "DocumentCounter"."value" + 1 RETURNING "value"`;
  return `${key}-${String(row.value).padStart(5, "0")}`;
}

/**
 * Émet la facture d'un achat payé. Refuse si l'identité de l'exploitant n'est pas
 * renseignée (aucune identité n'est inventée) : la facture reste « à émettre ».
 */
export async function issueInvoice(tx: Tx, purchaseId: string) {
  const existing = await tx.invoice.findUnique({ where: { purchaseId } });
  if (existing) return existing;
  const settings = await getSettings(tx);
  if (!sellerComplete(settings.seller)) return null;
  const p = await tx.purchase.findUnique({ where: { id: purchaseId }, include: { company: true, pack: true } });
  if (!p || !p.paidAt) return null;
  const c = p.company;
  return tx.invoice.create({
    data: {
      number: await nextNumber(tx, settings.invoicePrefix),
      purchaseId,
      companyId: p.companyId,
      sellerSnapshot: settings.seller,
      buyerSnapshot: {
        name: c.billingName || c.legalName, siret: c.siret, vatNumber: c.vatNumber, email: c.billingEmail || c.email,
        address: [c.billingAddress || c.addressLine, `${c.billingPostalCode || c.postalCode} ${c.billingCity || c.city}`].join(", "),
      },
      lines: [{ label: `${p.pack.name} — ${p.credits} crédits de mise en relation`, quantity: 1, unitHtCents: p.priceHtCents, vatRateBp: p.vatRateBp }],
      totalHtCents: p.priceHtCents,
      vatCents: p.vatCents,
      totalTtcCents: p.priceTtcCents,
    },
  });
}

export async function issuePendingInvoices() {
  const pending = await prisma.purchase.findMany({ where: { paidAt: { not: null }, invoice: null }, select: { id: true } });
  let issued = 0;
  for (const p of pending) {
    const inv = await prisma.$transaction((tx) => issueInvoice(tx, p.id));
    if (inv) issued++;
  }
  return { pending: pending.length, issued };
}

export async function issueCreditNote(tx: Tx, purchaseId: string, refundId: string, amountTtcCents: number, reason: string) {
  const settings = await getSettings(tx);
  const exists = await tx.creditNote.findUnique({ where: { stripeRefundId: refundId } });
  if (exists) return exists;
  return tx.creditNote.create({ data: { number: await nextNumber(tx, `${settings.invoicePrefix}AV`), purchaseId, stripeRefundId: refundId, amountTtcCents, reason } });
}

export async function invoicePdf(invoiceId: string, companyId?: string) {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { purchase: true } });
  if (!inv || (companyId && inv.companyId !== companyId)) throw notFound("Facture");
  const seller = inv.sellerSnapshot as Record<string, string>;
  const buyer = inv.buyerSnapshot as Record<string, string>;
  const lines = inv.lines as { label: string; quantity: number; unitHtCents: number; vatRateBp: number }[];
  if (!seller?.legalName) throw new AppError("NO_SELLER", "Identité de l'exploitant manquante");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let y = 800;
  const text = (t: string, x: number, size = 10, f = font) => page.drawText(t.replace(/[  ]/g, " "), { x, y, size, font: f, color: rgb(0.1, 0.12, 0.15) });
  text(`FACTURE ${inv.number}`, 40, 18, bold);
  y -= 22;
  text(`Date d'émission : ${inv.issuedAt.toLocaleDateString("fr-FR")}`, 40);
  y -= 30;
  text("Émetteur", 40, 11, bold);
  text("Client", 320, 11, bold);
  y -= 15;
  const left = [seller.legalName, seller.legalForm, seller.address, seller.siret && `SIRET ${seller.siret}`, seller.rcs, seller.capital && `Capital ${seller.capital}`, seller.vatNumber && `TVA ${seller.vatNumber}`, seller.email].filter(Boolean) as string[];
  const right = [buyer.name, buyer.address, buyer.siret && `SIRET ${buyer.siret}`, buyer.vatNumber && `TVA ${buyer.vatNumber}`, buyer.email].filter(Boolean) as string[];
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    if (left[i]) text(left[i].slice(0, 55), 40);
    if (right[i]) text(right[i].slice(0, 50), 320);
    y -= 13;
  }
  y -= 20;
  text("Désignation", 40, 10, bold);
  text("HT", 380, 10, bold);
  text("TVA", 440, 10, bold);
  text("TTC", 500, 10, bold);
  y -= 15;
  for (const l of lines) {
    const vat = Math.round((l.unitHtCents * l.vatRateBp) / 10000);
    text(l.label.slice(0, 60), 40);
    text(euros(l.unitHtCents), 380);
    text(vatLabel(l.vatRateBp), 440);
    text(euros(l.unitHtCents + vat), 500);
    y -= 15;
  }
  y -= 15;
  text(`Total HT : ${euros(inv.totalHtCents)}`, 380, 10, bold);
  y -= 14;
  text(`TVA : ${euros(inv.vatCents)}`, 380);
  y -= 14;
  text(`Total TTC : ${euros(inv.totalTtcCents)}`, 380, 11, bold);
  y -= 30;
  text(`Réglé par carte via Stripe le ${inv.purchase.paidAt?.toLocaleDateString("fr-FR") ?? "-"}. Référence achat ${inv.purchaseId}.`, 40, 9);
  y -= 13;
  text(`Crédits de mise en relation ${BRAND_NAME}. Aucune commission sur les locations.`, 40, 9);
  y -= 13;
  text("Mentions légales complémentaires (pénalités, indemnité forfaitaire...) : à compléter par l'exploitant.", 40, 8);
  return Buffer.from(await pdf.save());
}
