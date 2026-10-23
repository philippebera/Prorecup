import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { pushConfigured } from "@/lib/integrations";
import { AppError } from "@/lib/errors";

export const POST = api(async (req: NextRequest) => {
  const user = await requireApiUser();
  if (!pushConfigured()) throw new AppError("PUSH_NOT_CONFIGURED", "Les notifications push ne sont pas configurées sur la plateforme", 503);
  const d = await body(req, z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) }));
  await prisma.pushSubscription.upsert({
    where: { endpoint: d.endpoint },
    create: { userId: user.id, endpoint: d.endpoint, p256dh: d.keys.p256dh, auth: d.keys.auth },
    update: { userId: user.id, p256dh: d.keys.p256dh, auth: d.keys.auth },
  });
  return ok();
});

export const DELETE = api(async (req: NextRequest) => {
  const user = await requireApiUser();
  const d = await body(req, z.object({ endpoint: z.string().max(1000) }));
  await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: d.endpoint } });
  return ok();
});
