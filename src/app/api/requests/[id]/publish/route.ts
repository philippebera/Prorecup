import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { publishRequest } from "@/lib/requests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  const input = await body(req, z.object({ contactConsent: z.boolean(), marketingConsent: z.boolean().default(false) }));
  return ok(await publishRequest(id, input));
});
