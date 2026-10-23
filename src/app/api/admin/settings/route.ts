import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { setSetting, type PlatformSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";

const schema = z.object({
  welcomeCredits: z.number().int().min(0).max(50),
  maxUnlocksPerRequest: z.number().int().min(1).max(10),
  creditsPerUnlock: z.number().int().min(1).max(10),
  vatRateBp: z.number().int().min(0).max(3000),
  claimWindowDays: z.number().int().min(1).max(60),
  unlockAccessDays: z.number().int().min(1).max(3650),
  clientLinkTtlHours: z.number().int().min(1).max(720),
  maxRecipientsPerRequest: z.number().int().min(1).max(200),
  otpTtlMinutes: z.number().int().min(5).max(60),
  requestRetentionDays: z.number().int().min(30).max(3650),
  invoicePrefix: z.string().regex(/^[A-Z0-9]{1,6}$/),
  commercialPolicyValidated: z.boolean(),
  seller: z.object({
    legalName: z.string().max(150), legalForm: z.string().max(100), address: z.string().max(300), siret: z.string().max(20),
    vatNumber: z.string().max(20), rcs: z.string().max(100), capital: z.string().max(50), email: z.string().max(150),
  }),
}).partial();

export const PUT = api(async (req: NextRequest) => {
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, schema);
  for (const [k, v] of Object.entries(d)) await setSetting(k as keyof PlatformSettings, v as never, admin.id);
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: "SETTINGS_UPDATED", entityType: "PlatformSetting", entityId: "global", data: d });
  return ok();
});
