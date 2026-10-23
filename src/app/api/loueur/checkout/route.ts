import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { createCheckout } from "@/lib/payments";

// Seul l'identifiant du pack est accepté : aucun prix venant du navigateur.
export const POST = api(async (req: NextRequest) => {
  const { user, company } = await requireApiProvider();
  await limit(req, "checkout", 20, 3600);
  const { packId, returnTo } = await body(req, z.object({ packId: z.string().min(1), returnTo: z.string().max(200).optional() }).strict());
  return ok(await createCheckout({ companyId: company.id, userId: user.id, packId, returnTo }));
});
