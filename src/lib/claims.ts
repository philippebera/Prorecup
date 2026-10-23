import type { ClaimReason } from "@prisma/client";
import { prisma } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { getSettings } from "./settings";
import { applyLedger } from "./credits";
import { audit } from "./audit";
import { notifyCompany } from "./notifications/queue";

export const CLAIM_REASONS: { code: ClaimReason; label: string }[] = [
  { code: "INVALID_CONTACT", label: "Coordonnées fausses ou inutilisables" },
  { code: "FRAUDULENT", label: "Demande frauduleuse" },
  { code: "DUPLICATE", label: "Doublon d'une demande déjà achetée par mon entreprise" },
  { code: "MISMATCH", label: "Besoin manifestement différent de l'aperçu" },
  { code: "OUT_OF_CRITERIA", label: "Hors de ma zone ou de mes services annoncés" },
];

export async function createClaim(params: { unlockId: string; companyId: string; userId: string; reason: ClaimReason; details: string }) {
  if (params.details.trim().length < 10) throw new AppError("DETAILS_REQUIRED", "Décrivez le problème (10 caractères minimum)");
  const unlock = await prisma.unlock.findUnique({ where: { id: params.unlockId }, include: { claims: true } });
  if (!unlock) throw notFound("Déblocage");
  if (unlock.companyId !== params.companyId) throw forbidden();
  const settings = await getSettings();
  const deadline = new Date(unlock.createdAt.getTime() + settings.claimWindowDays * 86400_000);
  if (new Date() > deadline) throw new AppError("CLAIM_WINDOW_CLOSED", `Le signalement doit être fait dans les ${settings.claimWindowDays} jours suivant le déblocage`);
  if (unlock.claims.length) throw new AppError("CLAIM_EXISTS", "Un signalement existe déjà pour ce contact", 409);
  const claim = await prisma.claim.create({
    data: { unlockId: unlock.id, companyId: unlock.companyId, requestId: unlock.requestId, reason: params.reason, details: params.details.trim().slice(0, 2000), createdById: params.userId },
  });
  await audit({ actorUserId: params.userId, actorType: "PROVIDER", action: "CLAIM_CREATED", entityType: "Claim", entityId: claim.id, data: { reason: params.reason } });
  return claim;
}

/**
 * Décision administrateur. Une restitution recrédite le portefeuille (registre,
 * type RESTITUTION, référence unique) : c'est distinct d'un remboursement monétaire.
 */
export async function resolveClaim(params: { claimId: string; adminId: string; accept: boolean; resolution: string }) {
  if (params.resolution.trim().length < 5) throw new AppError("REASON_REQUIRED", "Une justification est obligatoire");
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Claim" WHERE id = ${params.claimId} FOR UPDATE`;
    const claim = await tx.claim.findUnique({ where: { id: params.claimId } });
    if (!claim) throw notFound("Signalement");
    if (claim.status !== "OPEN") throw new AppError("ALREADY_RESOLVED", "Signalement déjà traité", 409);
    let ledgerId: string | null = null;
    if (params.accept) {
      const res = await applyLedger(tx, {
        companyId: claim.companyId, type: "RESTITUTION", amount: settings.creditsPerUnlock, reference: `restitution:${claim.id}`,
        reason: params.resolution.trim(), actorUserId: params.adminId, claimId: claim.id, requestId: claim.requestId,
      });
      ledgerId = res.entry.id;
    }
    const updated = await tx.claim.update({
      where: { id: claim.id },
      data: { status: params.accept ? "ACCEPTED" : "REJECTED", resolution: params.resolution.trim(), resolvedById: params.adminId, resolvedAt: new Date() },
    });
    await audit({ actorUserId: params.adminId, actorType: "ADMIN", action: params.accept ? "CLAIM_ACCEPTED" : "CLAIM_REJECTED", entityType: "Claim", entityId: claim.id, data: { ledgerId } }, tx);
    await notifyCompany(tx, claim.companyId, {
      kind: "CLAIM_RESOLVED", key: `claim:${claim.id}`, title: params.accept ? "Crédit restitué" : "Signalement refusé",
      body: params.accept ? `Votre signalement a été accepté : ${settings.creditsPerUnlock} crédit restitué.` : `Votre signalement a été refusé : ${params.resolution.trim()}`,
      link: "/loueur/portefeuille",
    });
    return updated;
  });
}
