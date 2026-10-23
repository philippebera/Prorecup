import { api, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { audit } from "@/lib/audit";

// Suppression du compte utilisateur : anonymisation (l'historique comptable de l'entreprise est conservé).
export const DELETE = api(async () => {
  const user = await requireApiUser();
  if (user.membership?.role === "OWNER") {
    const owners = await prisma.companyMember.count({ where: { companyId: user.membership.companyId, role: "OWNER" } });
    if (owners <= 1) throw new AppError("LAST_OWNER", "Désignez un autre responsable ou contactez l'administration pour fermer l'entreprise");
  }
  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.pushSubscription.deleteMany({ where: { userId: user.id } }),
    prisma.companyMember.deleteMany({ where: { userId: user.id } }),
    prisma.user.update({ where: { id: user.id }, data: { email: `supprime-${user.id}@invalid`, name: "Utilisateur supprimé", phone: null, passwordHash: null, deletedAt: new Date() } }),
  ]);
  await audit({ actorUserId: user.id, actorType: user.role === "ADMIN" ? "ADMIN" : "PROVIDER", action: "ACCOUNT_DELETED", entityType: "User", entityId: user.id });
  return ok();
});
