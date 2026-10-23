import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, clientIp, limit, ok } from "@/lib/http";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/crypto";
import { createSession } from "@/lib/auth/core";
import { setSessionCookie } from "@/lib/auth/server";
import { AppError } from "@/lib/errors";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "login", 10, 900);
  const { email, password } = await body(req, z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) }));
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = await verifyPassword(password, user?.passwordHash);
  if (!user || !valid || user.disabledAt || user.deletedAt) throw new AppError("BAD_CREDENTIALS", "Email ou mot de passe incorrect", 401);
  const s = await createSession(user.id, { ip: clientIp(req), userAgent: req.headers.get("user-agent") ?? undefined });
  await setSessionCookie(s.token, s.expiresAt);
  const redirect = user.role === "ADMIN" ? "/admin" : user.role === "PROVIDER" ? "/loueur" : "/suivi";
  return ok({ redirect });
});
