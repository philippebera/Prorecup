import { prisma, type Tx } from "./db";

export async function audit(
  entry: {
    actorUserId?: string | null;
    actorType: "ADMIN" | "PROVIDER" | "CLIENT" | "SYSTEM" | "STRIPE";
    action: string;
    entityType: string;
    entityId: string;
    data?: Record<string, unknown>;
  },
  db: Tx | typeof prisma = prisma,
) {
  await db.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      actorType: entry.actorType,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      data: (entry.data ?? undefined) as object | undefined,
    },
  });
}
