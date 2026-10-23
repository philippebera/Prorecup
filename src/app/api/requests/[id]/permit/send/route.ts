import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { sendPermitFromApp } from "@/lib/permits";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "permit-send", 3, 3600);
  const { confirmed } = await body(req, z.object({ confirmed: z.boolean() }));
  await sendPermitFromApp(id, confirmed);
  return ok();
});
