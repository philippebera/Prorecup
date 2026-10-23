import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { prisma } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { enqueue } from "@/lib/notifications/queue";
import { APP_URL } from "@/lib/brand";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "reset", 5, 3600);
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  const user = await prisma.user.findUnique({ where: { email } });
  if (user && !user.deletedAt) {
    const token = randomToken(32);
    const row = await prisma.passwordReset.create({ data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 3600_000) } });
    // Le jeton n'est envoyé que par email ; il n'est pas conservé en clair après l'envoi.
    await enqueue(prisma, [
      { channel: "EMAIL", kind: "PASSWORD_RESET", dedupeKey: `reset:${row.id}`, userId: user.id, toAddress: user.email, title: "Réinitialisation du mot de passe", body: `Pour choisir un nouveau mot de passe (lien valable 1 h) : ${APP_URL}/mot-de-passe/nouveau?t=${token}\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.` },
    ]);
  }
  return ok({ message: "Si un compte existe pour cet email, un lien de réinitialisation a été programmé à l'envoi." });
});
