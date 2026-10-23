import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, ok } from "@/lib/http";
import { requireApiUser } from "@/lib/auth/server";
import { approveCompany, recordVerification, setCompanyStatus } from "@/lib/companies";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), grantWelcome: z.boolean().default(true), note: z.string().max(500).optional() }),
  z.object({ action: z.enum(["suspend", "reject", "pending"]), reason: z.string().min(3).max(500) }),
  z.object({ action: z.literal("verify"), field: z.enum(["SIRET", "IDENTITY", "PHONE", "EMAIL", "ADDRESS", "INSURANCE", "WASTE_PERMITS"]), method: z.string().min(3).max(200), note: z.string().max(500).optional() }),
]);

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const admin = await requireApiUser("ADMIN");
  const d = await body(req, schema);
  if (d.action === "approve") return ok(await approveCompany(id, admin.id, d));
  if (d.action === "verify") {
    await recordVerification(id, d.field, d.method, admin.id, d.note);
    return ok();
  }
  await setCompanyStatus(id, d.action === "suspend" ? "SUSPENDED" : d.action === "reject" ? "REJECTED" : "PENDING", admin.id, d.reason);
  return ok();
});
