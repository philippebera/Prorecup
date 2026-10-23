import { prisma } from "./db";
import { AppError, forbidden, notFound } from "./errors";
import { applyLedger } from "./credits";
import { getSettings } from "./settings";
import { enqueue } from "./notifications/queue";
import { audit } from "./audit";

export const UNLOCK_WARNING =
  "Débloquer ce contact pour 1 crédit. Ce contact peut être partagé avec deux autres entreprises maximum. Une location n'est pas garantie.";

export type UnlockResult = { status: "UNLOCKED" | "ALREADY_UNLOCKED"; unlockId: string; balance: number | null };

/**
 * Déblocage d'un contact — transaction atomique :
 *  1. verrou de la ligne Request (FOR UPDATE) : sérialise les achats concurrents d'une même demande ;
 *  2. un déblocage existant pour l'entreprise est renvoyé sans nouveau débit ;
 *  3. contrôles : entreprise validée, destinataire de la demande, demande ouverte, place restante ;
 *  4. débit d'exactement N crédits via le registre (verrou du portefeuille, solde ≥ 0) ;
 *  5. création du déblocage (unique par demande et entreprise) et incrément du compteur
 *     (contrainte CHECK unlockCount ≤ maxUnlocks).
 * Toute erreur annule l'ensemble : aucun crédit n'est retiré si la place n'est plus disponible.
 */
export async function unlockRequest(params: { requestId: string; companyId: string; userId: string; confirmed: boolean }): Promise<UnlockResult> {
  if (!params.confirmed) throw new AppError("CONFIRMATION_REQUIRED", UNLOCK_WARNING);
  const settings = await getSettings();
  return prisma.$transaction(
    async (tx) => {
      const [req] = await tx.$queryRaw<{ id: string; status: string; unlockCount: number; maxUnlocks: number; publicRef: string; email: string | null; emailVerifiedAt: Date | null; phone: string | null; phoneVerifiedAt: Date | null; contactPreference: string }[]>`
        SELECT id, status, "unlockCount", "maxUnlocks", "publicRef", email, "emailVerifiedAt", phone, "phoneVerifiedAt", "contactPreference"
        FROM "Request" WHERE id = ${params.requestId} FOR UPDATE`;
      if (!req) throw notFound("Demande");

      const existing = await tx.unlock.findUnique({ where: { requestId_companyId: { requestId: params.requestId, companyId: params.companyId } } });
      if (existing) return { status: "ALREADY_UNLOCKED" as const, unlockId: existing.id, balance: null };

      const company = await tx.company.findUnique({ where: { id: params.companyId }, select: { status: true, legalName: true, tradeName: true } });
      if (!company || company.status !== "APPROVED") throw forbidden("Votre entreprise doit être validée par l'administration avant de débloquer des contacts");
      const member = await tx.companyMember.findUnique({ where: { userId: params.userId } });
      if (!member || member.companyId !== params.companyId) throw forbidden();

      const recipient = await tx.requestRecipient.findUnique({ where: { requestId_companyId: { requestId: params.requestId, companyId: params.companyId } } });
      if (!recipient?.notifiedAt) throw forbidden("Cette demande n'a pas été adressée à votre entreprise");

      if (req.status !== "PUBLISHED") throw new AppError("REQUEST_UNAVAILABLE", "Cette demande n'est plus disponible", 409);
      if (req.unlockCount >= req.maxUnlocks) throw new AppError("REQUEST_FULL", "Les places disponibles pour cette demande sont déjà attribuées. Aucun crédit n'a été retiré.", 409);

      const { entry } = await applyLedger(tx, {
        companyId: params.companyId,
        type: "UNLOCK",
        amount: -settings.creditsPerUnlock,
        reference: `unlock:${params.requestId}:${params.companyId}`,
        reason: `Déblocage ${req.publicRef}`,
        actorUserId: params.userId,
        requestId: params.requestId,
      });

      const unlock = await tx.unlock.create({
        data: {
          requestId: params.requestId,
          companyId: params.companyId,
          userId: params.userId,
          ledgerEntryId: entry.id,
          accessExpiresAt: new Date(Date.now() + settings.unlockAccessDays * 86400_000),
        },
      });
      await tx.request.update({ where: { id: params.requestId }, data: { unlockCount: { increment: 1 } } });

      const name = company.tradeName || company.legalName;
      if (req.email && req.emailVerifiedAt) {
        await enqueue(tx, [
          {
            channel: "EMAIL",
            kind: "CLIENT_UNLOCKED",
            dedupeKey: `client-unlock:${unlock.id}`,
            requestId: params.requestId,
            toAddress: req.email,
            title: `${name} a reçu vos coordonnées`,
            body: `L'entreprise ${name} a obtenu vos coordonnées pour votre demande ${req.publicRef} et pourra vous contacter. Consultez votre demande : {{TRACKING_LINK}}`,
          },
        ]);
      } else if (req.phone && req.phoneVerifiedAt) {
        await enqueue(tx, [
          {
            channel: "SMS",
            kind: "CLIENT_UNLOCKED",
            dedupeKey: `client-unlock-sms:${unlock.id}`,
            requestId: params.requestId,
            toAddress: req.phone,
            title: `${name} a reçu vos coordonnées`,
            body: `Demande ${req.publicRef}. Suivi : {{TRACKING_LINK}}`,
          },
        ]);
      }
      await audit({ actorUserId: params.userId, actorType: "PROVIDER", action: "UNLOCK", entityType: "Request", entityId: params.requestId, data: { companyId: params.companyId, ledger: entry.id } }, tx);
      return { status: "UNLOCKED" as const, unlockId: unlock.id, balance: entry.balanceAfter };
    },
    { timeout: 15000 },
  );
}
