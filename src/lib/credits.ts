import type { LedgerType } from "@prisma/client";
import { prisma, type Tx } from "./db";
import { AppError } from "./errors";

export type LedgerInput = {
  companyId: string;
  type: LedgerType;
  amount: number;
  reference: string;
  reason?: string;
  actorUserId?: string | null;
  purchaseId?: string;
  requestId?: string;
  claimId?: string;
};

/**
 * Seul point d'écriture des crédits. À appeler dans une transaction.
 * - verrouille le portefeuille de l'entreprise (FOR UPDATE) ;
 * - idempotent : une référence déjà utilisée renvoie l'écriture existante sans rien modifier ;
 * - refuse un solde négatif (contrôlé ici et par une contrainte CHECK en base).
 */
export async function applyLedger(tx: Tx, input: LedgerInput) {
  if (!Number.isInteger(input.amount) || input.amount === 0) throw new AppError("INVALID_AMOUNT", "Montant de crédits invalide");
  await tx.$executeRaw`INSERT INTO "CreditWallet" ("companyId", "balance", "updatedAt") VALUES (${input.companyId}, 0, now()) ON CONFLICT DO NOTHING`;
  const [wallet] = await tx.$queryRaw<{ balance: number }[]>`SELECT "balance" FROM "CreditWallet" WHERE "companyId" = ${input.companyId} FOR UPDATE`;

  const existing = await tx.creditLedgerEntry.findUnique({ where: { reference: input.reference } });
  if (existing) return { entry: existing, duplicate: true as const };

  const balanceAfter = wallet.balance + input.amount;
  if (balanceAfter < 0) throw new AppError("INSUFFICIENT_CREDITS", "Solde de crédits insuffisant", 402);

  const entry = await tx.creditLedgerEntry.create({
    data: {
      companyId: input.companyId,
      type: input.type,
      amount: input.amount,
      balanceAfter,
      reference: input.reference,
      reason: input.reason,
      actorUserId: input.actorUserId ?? null,
      purchaseId: input.purchaseId,
      requestId: input.requestId,
      claimId: input.claimId,
    },
  });
  await tx.creditWallet.update({ where: { companyId: input.companyId }, data: { balance: balanceAfter } });
  return { entry, duplicate: false as const };
}

export async function getBalance(companyId: string, db: Tx | typeof prisma = prisma) {
  const w = await db.creditWallet.findUnique({ where: { companyId } });
  return w?.balance ?? 0;
}

/** Contrôle de cohérence : le solde matérialisé doit égaler la somme du registre. */
export async function reconcile(companyId: string) {
  const [sum, balance] = await Promise.all([
    prisma.creditLedgerEntry.aggregate({ where: { companyId }, _sum: { amount: true } }),
    getBalance(companyId),
  ]);
  return { ledger: sum._sum.amount ?? 0, wallet: balance, ok: (sum._sum.amount ?? 0) === balance };
}

/** Ajustement administratif : motif obligatoire, journal d'audit. */
export async function adminAdjust(params: { companyId: string; amount: number; reason: string; adminId: string; reference: string }) {
  if (params.reason.trim().length < 5) throw new AppError("REASON_REQUIRED", "Un motif est obligatoire");
  return prisma.$transaction(async (tx) => {
    const res = await applyLedger(tx, {
      companyId: params.companyId,
      type: "ADMIN_ADJUSTMENT",
      amount: params.amount,
      reference: `admin:${params.reference}`,
      reason: params.reason.trim(),
      actorUserId: params.adminId,
    });
    if (!res.duplicate) {
      await tx.auditLog.create({
        data: {
          actorUserId: params.adminId, actorType: "ADMIN", action: "CREDIT_ADJUSTMENT", entityType: "Company",
          entityId: params.companyId, data: { amount: params.amount, reason: params.reason, entry: res.entry.id },
        },
      });
    }
    return res;
  });
}
