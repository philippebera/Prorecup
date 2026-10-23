import type { NextRequest } from "next/server";
import { api, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { createOffer } from "@/lib/offers";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { user, company } = await requireApiProvider();
  const offer = await createOffer({ requestId: id, companyId: company.id, userId: user.id, data: await req.json() });
  return ok({ id: offer.id });
});
