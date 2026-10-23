import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  id: z.string().optional(),
  code: z.string().regex(/^[A-Z0-9_]{2,30}$/),
  name: z.string().min(2).max(80),
  credits: z.number().int().min(1).max(1000),
  priceHtCents: z.number().int().min(100).max(10_000_000),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(100),
});

// Les achats conservent un instantané du prix : modifier un pack n'affecte pas les achats passés.
export const POST = api(async (req: NextRequest) => {
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, schema);
  const { id, ...data } = d;
  const pack = id ? await prisma.creditPack.update({ where: { id }, data }) : await prisma.creditPack.create({ data });
  await audit({ actorUserId: admin.id, actorType: "ADMIN", action: id ? "PACK_UPDATED" : "PACK_CREATED", entityType: "CreditPack", entityId: pack.id, data });
  return ok({ id: pack.id });
});
