import { prisma } from "./db";
import { getSettings } from "./settings";
import { deleteStoredFile } from "./storage";
import { audit } from "./audit";

/**
 * Anonymise une demande : supprime coordonnées, adresse, textes libres et photos.
 * Les déblocages, écritures de crédits et réclamations sont conservés (traçabilité comptable),
 * mais ne pointent plus vers des données personnelles.
 */
export async function anonymizeRequest(requestId: string, actor: "CLIENT" | "ADMIN" | "SYSTEM", actorUserId?: string) {
  const photos = await prisma.requestPhoto.findMany({ where: { requestId } });
  const permitFiles = await prisma.permitFile.findMany({ where: { permit: { requestId } } });
  await prisma.$transaction([
    prisma.request.update({
      where: { id: requestId },
      data: {
        contactName: "Données supprimées", email: null, phone: null, addressLine: "Adresse supprimée", addressComplement: null,
        accessDetails: null, wasteNotes: null, companyName: null, callbackHours: null, fingerprint: null, ipHash: null,
      },
    }),
    prisma.requestPhoto.deleteMany({ where: { requestId } }),
    prisma.permitFile.deleteMany({ where: { permit: { requestId } } }),
    prisma.clientAccessToken.updateMany({ where: { requestId, revokedAt: null }, data: { revokedAt: new Date() } }),
    prisma.verificationCode.deleteMany({ where: { requestId } }),
    prisma.notification.updateMany({ where: { requestId }, data: { toAddress: null } }),
  ]);
  for (const f of [...photos, ...permitFiles]) await deleteStoredFile(f.storageKey);
  await audit({ actorType: actor, actorUserId, action: "REQUEST_ANONYMIZED", entityType: "Request", entityId: requestId });
}

export async function purgeExpiredData() {
  const s = await getSettings();
  const cutoff = new Date(Date.now() - s.requestRetentionDays * 86400_000);
  const draftCutoff = new Date(Date.now() - 7 * 86400_000);
  const old = await prisma.request.findMany({
    where: {
      contactName: { not: "Données supprimées" },
      OR: [{ createdAt: { lt: cutoff } }, { status: "DRAFT", createdAt: { lt: draftCutoff } }],
    },
    select: { id: true },
    take: 500,
  });
  for (const r of old) await anonymizeRequest(r.id, "SYSTEM");
  const now = new Date();
  const [sessions, codes, buckets, tokens] = await Promise.all([
    prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 86400_000) } } }),
    prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: new Date(Date.now() - 2 * 86400_000) } } }),
    prisma.clientAccessToken.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 30 * 86400_000) } } }),
  ]);
  return { anonymized: old.length, sessions: sessions.count, codes: codes.count, buckets: buckets.count, tokens: tokens.count };
}
