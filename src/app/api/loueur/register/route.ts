import type { NextRequest } from "next/server";
import { api, limit, ok, clientIp } from "@/lib/http";
import { registerCompany } from "@/lib/companies";
import { createSession } from "@/lib/auth/core";
import { setSessionCookie } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/notifications/queue";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "register", 5, 3600);
  const { company, user } = await registerCompany(await req.json());
  const s = await createSession(user.id, { ip: clientIp(req) });
  await setSessionCookie(s.token, s.expiresAt);
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", disabledAt: null } });
  await enqueue(prisma, admins.flatMap((a) => [
    { channel: "IN_APP" as const, kind: "ADMIN_NEW_COMPANY", dedupeKey: `newco:${company.id}:${a.id}`, userId: a.id, title: "Nouvelle entreprise à valider", body: company.legalName, link: `/admin/entreprises/${company.id}` },
  ]));
  return ok({ redirect: "/loueur" });
});
