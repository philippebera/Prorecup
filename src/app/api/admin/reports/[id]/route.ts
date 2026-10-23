import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, z.object({ resolution: z.string().min(3).max(1000) }));
  await prisma.clientReport.update({ where: { id }, data: { status: "RESOLVED", resolution: d.resolution, resolvedAt: new Date() } });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "CLIENT_REPORT_RESOLVED", entityType: "ClientReport", entityId: id });
  return ok();
});
