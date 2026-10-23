import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

export const POST = api(async (req: NextRequest) => {
  const user = await requireApiUser();
  const d = await body(req, z.object({ ids: z.array(z.string()).max(200).optional(), all: z.boolean().optional() }));
  await prisma.notification.updateMany({
    where: { userId: user.id, channel: "IN_APP", readAt: null, ...(d.all ? {} : { id: { in: d.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return ok();
});
