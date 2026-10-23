import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { prisma } from "@/lib/db";
import { hashPassword, sha256 } from "@/lib/crypto";
import { AppError } from "@/lib/errors";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "reset-confirm", 10, 3600);
  const { token, password } = await body(req, z.object({ token: z.string().min(20), password: z.string().min(10, "10 caractères minimum").max(200) }));
  const row = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) throw new AppError("INVALID_TOKEN", "Lien invalide ou expiré");
  await prisma.$transaction([
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(password) } }),
    prisma.passwordReset.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: row.userId } }),
    prisma.notification.updateMany({ where: { kind: "PASSWORD_RESET", userId: row.userId }, data: { body: "Lien de réinitialisation (expiré)" } }),
  ]);
  return ok();
});
