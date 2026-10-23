import { z } from "zod";
import { prisma } from "./db";
import { AppError, forbidden } from "./errors";
import { vatFromHt } from "./money";
import { enqueue } from "./notifications/queue";
import { audit } from "./audit";

const cents = z.number().int().min(0).max(10_000_000);

export const offerSchema = z.object({
  volumeM3: z.number().int().min(1).max(60),
  wasteAllowed: z.string().trim().min(2).max(500),
  wasteExcluded: z.string().trim().min(2).max(500),
  includesDelivery: z.boolean(),
  includesTransport: z.boolean(),
  includesPickup: z.boolean(),
  includedDays: z.number().int().min(1).max(365),
  weightMode: z.enum(["INCLUDED", "ACTUAL"]),
  includedTonnes: z.number().min(0).max(100).nullable().optional(),
  pricePerTonneCents: cents.nullable().optional(),
  pricePerExtraDayCents: cents.nullable().optional(),
  otherFees: z.string().trim().max(500).optional().nullable(),
  amountHtCents: cents,
  vatRateBp: z.number().int().refine((v) => [0, 550, 1000, 2000].includes(v), "Taux de TVA non reconnu"),
  proposedAvailability: z.string().trim().min(2).max(200),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  message: z.string().trim().max(2000).optional().nullable(),
});

/** Une offre ne peut être envoyée que par une entreprise ayant débloqué la demande. */
export async function createOffer(params: { requestId: string; companyId: string; userId: string; data: unknown }) {
  const d = offerSchema.parse(params.data);
  const unlock = await prisma.unlock.findUnique({ where: { requestId_companyId: { requestId: params.requestId, companyId: params.companyId } } });
  if (!unlock) throw forbidden("Débloquez d'abord ce contact");
  const req = await prisma.request.findUniqueOrThrow({ where: { id: params.requestId } });
  if (["CLOSED", "CANCELLED", "FULFILLED", "ARCHIVED"].includes(req.status)) throw new AppError("REQUEST_CLOSED", "La demande est clôturée");
  if (d.weightMode === "INCLUDED" && d.includedTonnes == null) throw new AppError("TONNES_REQUIRED", "Indiquez le poids inclus");
  const validUntil = new Date(`${d.validUntil}T23:59:59Z`);
  if (validUntil < new Date()) throw new AppError("INVALID_VALIDITY", "La date de validité doit être future");
  const { vat, ttc } = vatFromHt(d.amountHtCents, d.vatRateBp);
  const company = await prisma.company.findUniqueOrThrow({ where: { id: params.companyId } });
  const offer = await prisma.offer.create({
    data: {
      requestId: params.requestId, companyId: params.companyId, userId: params.userId,
      volumeM3: d.volumeM3, wasteAllowed: d.wasteAllowed, wasteExcluded: d.wasteExcluded,
      includesDelivery: d.includesDelivery, includesTransport: d.includesTransport, includesPickup: d.includesPickup,
      includedDays: d.includedDays, weightMode: d.weightMode, includedTonnes: d.weightMode === "INCLUDED" ? d.includedTonnes : null,
      pricePerTonneCents: d.pricePerTonneCents ?? null, pricePerExtraDayCents: d.pricePerExtraDayCents ?? null,
      otherFees: d.otherFees || null, amountHtCents: d.amountHtCents, vatRateBp: d.vatRateBp, vatCents: vat, amountTtcCents: ttc,
      proposedAvailability: d.proposedAvailability, validUntil, message: d.message || null,
    },
  });
  const target = req.emailVerifiedAt && req.email ? { channel: "EMAIL" as const, to: req.email } : req.phoneVerifiedAt && req.phone ? { channel: "SMS" as const, to: req.phone } : null;
  if (target) {
    await enqueue(prisma, [
      {
        channel: target.channel, kind: "CLIENT_OFFER", dedupeKey: `offer:${offer.id}`, requestId: req.id, toAddress: target.to,
        title: `Nouvelle offre de ${company.tradeName || company.legalName}`,
        body: `Vous avez reçu une offre pour votre demande ${req.publicRef}. Consultez-la : {{TRACKING_LINK}}`,
      },
    ]);
  }
  await audit({ actorUserId: params.userId, actorType: "PROVIDER", action: "OFFER_SENT", entityType: "Offer", entityId: offer.id });
  return offer;
}

export async function withdrawOffer(offerId: string, companyId: string) {
  const o = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!o || o.companyId !== companyId) throw forbidden();
  return prisma.offer.update({ where: { id: offerId }, data: { status: "WITHDRAWN" } });
}
