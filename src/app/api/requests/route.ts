import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { api, body, clientIp, limit, ok } from "@/lib/http";
import { createRequestSchema } from "@/lib/requests/schema";
import { createDraft } from "@/lib/requests/service";
import { CLIENT_COOKIE } from "@/lib/auth/core";
import { sha256 } from "@/lib/crypto";
import { verifyCaptcha } from "@/lib/captcha";
import { AppError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "request-create", 5, 3600);
  const input = await body(req, createRequestSchema);
  if (input.website) throw new AppError("SPAM", "Demande refusée");
  if (input.startedAt && Date.now() - input.startedAt < 4000) throw new AppError("SPAM", "Demande refusée");
  await verifyCaptcha(input.captchaToken, clientIp(req));
  const { request, token } = await createDraft(input, { ipHash: sha256(clientIp(req)).slice(0, 32) });
  const settings = await getSettings();
  (await cookies()).set(CLIENT_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: settings.clientLinkTtlHours * 3600,
  });
  return ok({ id: request.id, publicRef: request.publicRef, contactPreference: request.contactPreference });
});
