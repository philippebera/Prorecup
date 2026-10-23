import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { clientReport } from "@/lib/requests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "client-report", 10, 3600);
  const input = await body(req, z.object({ reason: z.string().min(2).max(50), message: z.string().trim().min(5, "Décrivez le problème").max(2000), companyId: z.string().nullable().optional() }));
  await clientReport(id, input);
  return ok();
});
