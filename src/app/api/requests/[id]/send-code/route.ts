import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { sendVerificationCode } from "@/lib/requests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "otp-send", 10, 3600);
  const { channel } = await body(req, z.object({ channel: z.enum(["EMAIL", "PHONE"]) }));
  const res = await sendVerificationCode(id, channel);
  return ok(res);
});
