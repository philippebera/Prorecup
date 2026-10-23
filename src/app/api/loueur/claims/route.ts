import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { createClaim } from "@/lib/claims";

export const POST = api(async (req: NextRequest) => {
  const { user, company } = await requireApiProvider();
  const d = await body(req, z.object({ unlockId: z.string(), reason: z.enum(["INVALID_CONTACT", "FRAUDULENT", "DUPLICATE", "MISMATCH", "OUT_OF_CRITERIA"]), details: z.string().max(2000) }));
  const claim = await createClaim({ ...d, companyId: company.id, userId: user.id });
  return ok({ id: claim.id });
});
