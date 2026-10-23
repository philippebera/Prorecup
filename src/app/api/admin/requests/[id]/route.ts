import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { anonymizeRequest } from "@/lib/retention";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, z.object({ action: z.enum(["archive", "anonymize"]), reason: z.string().min(3).max(500) }));
  if (d.action === "archive") await prisma.request.update({ where: { id }, data: { status: "ARCHIVED", closedAt: new Date(), closeReason: d.reason } });
  else await anonymizeRequest(id, "ADMIN", admin.id);
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: `REQUEST_${d.action.toUpperCase()}`, entityType: "Request", entityId: id, data: { reason: d.reason } });
  return ok();
});
