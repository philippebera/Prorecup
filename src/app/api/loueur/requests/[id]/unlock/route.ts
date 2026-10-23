import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { unlockRequest } from "@/lib/unlock";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { user, company } = await requireApiProvider();
  const { confirmed } = await body(req, z.object({ confirmed: z.boolean() }));
  const r = await unlockRequest({ requestId: id, companyId: company.id, userId: user.id, confirmed });
  return ok({ status: r.status, balance: r.balance });
});
