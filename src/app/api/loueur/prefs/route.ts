import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { toE164 } from "@/lib/notifications/providers";
import { AppError } from "@/lib/errors";

export const PUT = api(async (req: NextRequest) => {
  const { company } = await requireApiProvider();
  const d = await body(
    req,
    z.object({
      notifyEmail: z.boolean(), notifySms: z.boolean(), notifyPush: z.boolean(),
      notifyQuietStart: z.number().int().min(0).max(23).nullable(), notifyQuietEnd: z.number().int().min(0).max(23).nullable(),
      smsPhone: z.string().trim().max(20).nullable(),
    }),
  );
  const smsPhone = d.smsPhone ? toE164(d.smsPhone) : null;
  if (d.notifySms && !smsPhone) throw new AppError("PHONE_REQUIRED", "Numéro mobile requis pour les SMS");
  await prisma.company.update({ where: { id: company.id }, data: { ...d, smsPhone } });
  return ok();
});
