import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireClientRequest, setSessionCookie } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/crypto";
import { createSession } from "@/lib/auth/core";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

/** Création d'un compte client rattaché à la demande : uniquement avec l'email vérifié de la demande. */
export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "client-account", 5, 3600);
  const { password } = await body(req, z.object({ password: z.string().min(10, "10 caractères minimum").max(200) }));
  const r = await prisma.request.findUniqueOrThrow({ where: { id } });
  if (!r.email || !r.emailVerifiedAt) throw new AppError("EMAIL_REQUIRED", "Un compte nécessite un email vérifié sur votre demande");
  const existing = await prisma.user.findUnique({ where: { email: r.email } });
  if (existing) throw new AppError("ACCOUNT_EXISTS", "Un compte existe déjà avec cet email : connectez-vous", 409);
  const user = await prisma.user.create({
    data: { email: r.email, name: r.contactName, role: "CLIENT", passwordHash: await hashPassword(password), emailVerifiedAt: r.emailVerifiedAt },
  });
  await prisma.request.updateMany({ where: { email: r.email, emailVerifiedAt: { not: null }, clientUserId: null }, data: { clientUserId: user.id } });
  const s = await createSession(user.id);
  await setSessionCookie(s.token, s.expiresAt);
  return ok();
});
