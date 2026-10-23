import type { NextRequest } from "next/server";
import { api, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { withdrawOffer } from "@/lib/offers";

type Ctx = { params: Promise<{ id: string }> };

export const DELETE = api(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { company } = await requireApiProvider();
  await withdrawOffer(id, company.id);
  return ok();
});
