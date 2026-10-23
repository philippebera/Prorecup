import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getStripe } from "@/lib/stripe";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

// Remboursement monétaire d'un pack (distinct d'une restitution de crédit).
// L'effet sur les crédits est appliqué à réception du webhook charge.refunded.
export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, z.discriminatedUnion("action", [
    z.object({ action: z.literal("resolve-review"), note: z.string().min(5).max(1000) }),
    z.object({ action: z.literal("refund"), amountCents: z.number().int().min(1).optional(), reason: z.string().min(5).max(500) }),
  ]));
  const p = await prisma.purchase.findUniqueOrThrow({ where: { id } });
  if (d.action === "resolve-review") {
    await prisma.purchase.update({ where: { id }, data: { needsAdminReview: false, adminReviewNote: `${p.adminReviewNote ?? ""}\n[${new Date().toISOString()}] ${d.note}`.trim() } });
  } else {
    if (!p.stripePaymentIntentId || !p.paidAt) throw new AppError("NOT_PAID", "Achat non payé");
    await getStripe().refunds.create({ payment_intent: p.stripePaymentIntentId, amount: d.amountCents, metadata: { purchaseId: p.id, adminId: admin.id } }, { idempotencyKey: `refund:${p.id}:${d.amountCents ?? "full"}` });
  }
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: d.action === "refund" ? "REFUND_REQUESTED" : "PURCHASE_REVIEWED", entityType: "Purchase", entityId: id, data: d });
  return ok();
});
