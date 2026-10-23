import type { NextRequest } from "next/server";
import { api, ok, limit } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "photo-upload", 30, 3600);
  const r = await prisma.request.findUniqueOrThrow({ where: { id }, include: { _count: { select: { photos: true } } } });
  if (r.status !== "DRAFT" && r.status !== "PUBLISHED") throw new AppError("CLOSED", "Demande clôturée");
  const form = await req.formData();
  const files = form.getAll("photos").filter((f): f is File => f instanceof File);
  if (r._count.photos + files.length > 5) throw new AppError("TOO_MANY", "5 photos maximum");
  const saved = [];
  for (const f of files) {
    const { key, mime, size } = await saveFile(Buffer.from(await f.arrayBuffer()), "requests", ["image/jpeg", "image/png", "image/webp"]);
    saved.push(await prisma.requestPhoto.create({ data: { requestId: id, storageKey: key, mimeType: mime, sizeBytes: size } }));
  }
  return ok({ count: saved.length });
});
