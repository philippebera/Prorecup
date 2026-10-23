import type { NextRequest } from "next/server";
import { api, limit, ok } from "@/lib/http";
import { requireClientRequest } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { AppError } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export const POST = api(async (req: NextRequest, { params }: Ctx) => {
  const { id } = await params;
  await requireClientRequest(id);
  await limit(req, "permit-upload", 30, 3600);
  const permit = await prisma.permit.findUniqueOrThrow({ where: { requestId: id }, include: { _count: { select: { files: true } } } });
  const form = await req.formData();
  const kind = String(form.get("kind"));
  if (!["PLAN", "PHOTO", "AUTHORIZATION", "OTHER"].includes(kind)) throw new AppError("BAD_KIND", "Type de document invalide");
  const file = form.get("file");
  if (!(file instanceof File)) throw new AppError("NO_FILE", "Aucun fichier");
  if (permit._count.files >= 15) throw new AppError("TOO_MANY", "15 documents maximum");
  const { key, mime, size } = await saveFile(Buffer.from(await file.arrayBuffer()), "permits", ["image/jpeg", "image/png", "application/pdf"]);
  await prisma.permitFile.create({ data: { permitId: permit.id, kind, storageKey: key, mimeType: mime, sizeBytes: size } });
  return ok();
});
