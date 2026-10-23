import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { channelConfigured, processQueue } from "@/lib/notifications/queue";
import { AppError } from "@/lib/errors";

export const POST = api(async (req: NextRequest) => {
  await requireApiUser("ADMIN");
  const d = await body(req, z.object({ action: z.enum(["retry", "process"]), id: z.string().optional() }));
  if (d.action === "retry" && d.id) {
    const n = await prisma.notification.findUniqueOrThrow({ where: { id: d.id } });
    if (!channelConfigured(n.channel)) throw new AppError("NOT_CONFIGURED", "Canal toujours non configuré");
    await prisma.notification.update({ where: { id: d.id }, data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date() } });
  }
  return ok(await processQueue(100));
});
