import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { setPermitStatus } from "@/lib/permits";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  const input = await body(req, z.object({ status: z.enum(["SENT_BY_USER", "RECEIPT_CONFIRMED", "INFO_REQUESTED", "GRANTED", "REFUSED", "TO_PREPARE"]), note: z.string().max(500).optional() }));
  await setPermitStatus(id, input.status, input.note);
  return ok();
});
