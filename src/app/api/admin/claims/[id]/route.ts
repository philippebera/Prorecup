import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { resolveClaim } from "@/lib/claims";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, z.object({ accept: z.boolean(), resolution: z.string().max(1000) }));
  await resolveClaim({ claimId: id, adminId: admin.id, ...d });
  return ok();
});
