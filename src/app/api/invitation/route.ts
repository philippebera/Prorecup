import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { acceptInvitation } from "@/lib/companies";
import { createSession } from "@/lib/auth/core";
import { setSessionCookie } from "@/lib/auth/server";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "invite-accept", 10, 3600);
  const d = await body(req, z.object({ token: z.string().min(10), name: z.string().trim().min(2).max(100), password: z.string().min(10).max(200) }));
  const user = await acceptInvitation(d.token, d);
  const s = await createSession(user.id);
  await setSessionCookie(s.token, s.expiresAt);
  return ok({ redirect: "/loueur" });
});
