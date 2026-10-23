import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { inviteMember } from "@/lib/companies";
import { forbidden } from "@/lib/errors";
import { enqueue } from "@/lib/notifications/queue";
import { prisma } from "@/lib/db";
import { APP_URL, BRAND_NAME } from "@/lib/brand";

export const POST = api(async (req: NextRequest) => {
  const { user, company, memberRole } = await requireApiProvider();
  if (memberRole !== "OWNER") throw forbidden("Réservé au responsable de l'entreprise");
  await limit(req, "invite", 20, 3600);
  const { email } = await body(req, z.object({ email: z.string().trim().toLowerCase().email() }));
  const token = await inviteMember(company.id, email, user.id);
  const link = `${APP_URL}/invitation?t=${token}`;
  await enqueue(prisma, [
    { channel: "EMAIL", kind: "INVITATION", dedupeKey: `invite:${company.id}:${email}:${Date.now()}`, companyId: company.id, toAddress: email, title: `Invitation à rejoindre ${company.legalName}`, body: `${user.name} vous invite à rejoindre ${company.legalName} sur ${BRAND_NAME} : ${link} (valable 7 jours)` },
  ]);
  // Le lien est aussi renvoyé au responsable, qui peut le transmettre lui-même si l'email n'est pas configuré.
  return ok({ link });
});
