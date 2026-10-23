import type { NextRequest } from "next/server";
import { api, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { prepareRecipients } from "@/lib/requests/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  return ok({ recipients: await prepareRecipients(id) });
});
