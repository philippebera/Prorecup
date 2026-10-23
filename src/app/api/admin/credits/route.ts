import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { adminAdjust } from "@/lib/credits";

export const POST = api(async (req: NextRequest) => {
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, z.object({ companyId: z.string(), amount: z.number().int().min(-1000).max(1000).refine((n) => n !== 0), reason: z.string().min(5).max(500), idempotencyKey: z.string().min(8).max(64) }));
  const r = await adminAdjust({ companyId: d.companyId, amount: d.amount, reason: d.reason, adminId: admin.id, reference: d.idempotencyKey });
  return ok({ duplicate: r.duplicate, balance: r.entry.balanceAfter });
});
