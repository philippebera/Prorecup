import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { verifyCode } from "@/lib/requests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "otp-verify", 30, 3600);
  const { channel, code } = await body(req, z.object({ channel: z.enum(["EMAIL", "PHONE"]), code: z.string().regex(/^\d{6}$/, "Code à 6 chiffres") }));
  return ok(await verifyCode(id, channel, code));
});
