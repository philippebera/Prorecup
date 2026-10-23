import type { NextRequest } from "next/server";
import { api } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { permitPdf } from "@/lib/permits";

type Ctx = { params: Promise<{ id: string }> };

export const GET = api(async (_req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  const pdf = await permitPdf(id);
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="dossier-voirie.pdf"`, "X-Robots-Tag": "noindex" },
  });
});
