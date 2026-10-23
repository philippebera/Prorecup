import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { KNOWN_FORM_TEMPLATES } from "@/lib/permits";
import { AppError } from "@/lib/errors";

const opt = (max: number) => z.string().trim().max(max).nullable().optional().transform((v) => v || null);
const schema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2).max(200),
  kind: z.enum(["MAIRIE", "METROPOLE", "DEPARTEMENT", "AUTRE"]),
  departmentCode: z.string().min(2).max(3),
  postalCodes: z.array(z.string().regex(/^\d{5}$/)).max(200),
  inseeCodes: z.array(z.string().max(5)).max(200).default([]),
  portalUrl: opt(500), formUrl: opt(500), email: opt(200), phone: opt(30),
  instructions: opt(3000), feesInfo: opt(1000), delayInfo: opt(1000),
  submissionEmail: opt(200),
  submissionEmailVerified: z.boolean(),
  knownFormTemplate: opt(100),
  markVerifiedNow: z.boolean().default(false),
  active: z.boolean(),
});

export const POST = api(async (req: NextRequest) => {
  const admin = await requireApiUser("ADMIN");
  const { id, markVerifiedNow, ...d } = await body(req, schema);
  if (d.submissionEmailVerified && !d.submissionEmail) throw new AppError("NO_EMAIL", "Canal de dépôt vérifié sans adresse");
  if (d.knownFormTemplate && !KNOWN_FORM_TEMPLATES[d.knownFormTemplate]) throw new AppError("UNKNOWN_TEMPLATE", "Modèle de formulaire inconnu du code");
  const data = { ...d, ...(markVerifiedNow ? { lastVerifiedAt: new Date(), verifiedBy: admin.name } : {}) };
  const a = id ? await prisma.permitAuthority.update({ where: { id }, data }) : await prisma.permitAuthority.create({ data });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: id ? "AUTHORITY_UPDATED" : "AUTHORITY_CREATED", entityType: "PermitAuthority", entityId: a.id });
  return ok({ id: a.id });
});
