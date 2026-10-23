import type { NextRequest } from "next/server";
import { api, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { updatePermit } from "@/lib/permits";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  if (!(await prisma.permit.findUnique({ where: { requestId: id } }))) await prisma.permit.create({ data: { requestId: id } });
  const p = await updatePermit(id, await req.json());
  return ok({ status: p.status });
});
