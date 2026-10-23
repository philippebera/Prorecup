import type { NextRequest } from "next/server";
import { api } from "@/lib/http";
import { requireApiProvider } from "@/lib/auth/server";
import { invoicePdf } from "@/lib/invoices";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  const { company } = await requireApiProvider();
  const pdf = await invoicePdf(id, company.id);
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="facture-${id}.pdf"` } });
});
