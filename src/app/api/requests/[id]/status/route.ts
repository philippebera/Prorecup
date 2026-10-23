import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { clientSetStatus } from "@/lib/requests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  const input = await body(
    req,
    z.object({ action: z.enum(["pause", "resume", "close", "cancel", "fulfilled"]), reason: z.string().max(300).optional(), chosenCompanyId: z.string().nullable().optional() }),
  );
  const r = await clientSetStatus(id, input.action, input);
  return ok({ status: r.status });
});
