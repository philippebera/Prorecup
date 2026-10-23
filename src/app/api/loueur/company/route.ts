import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, ok } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { updateCompanyProfile } from "@/lib/companies";
import { prisma } from "@/lib/db";
import { forbidden } from "@/lib/errors";

const billingSchema = z.object({
  billingName: z.string().trim().max(150).nullable().optional(),
  billingEmail: z.string().trim().email().nullable().optional().or(z.literal("")),
  billingAddress: z.string().trim().max(200).nullable().optional(),
  billingPostalCode: z.string().trim().max(10).nullable().optional(),
  billingCity: z.string().trim().max(100).nullable().optional(),
});

export const PUT = api(async (req: NextRequest) => {
  const { user, company, memberRole } = await requireApiProvider();
  if (memberRole !== "OWNER") throw forbidden("Réservé au responsable de l'entreprise");
  const raw = await req.json();
  await updateCompanyProfile(company.id, raw, user.id);
  const billing = billingSchema.parse(raw);
  await prisma.company.update({ where: { id: company.id }, data: { ...billing, billingEmail: billing.billingEmail || null } });
  return ok();
});
