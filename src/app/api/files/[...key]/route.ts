import type { NextRequest } from "next/server";
import { mimeFromKey, readStoredFile, verifyFileSignature } from "@/lib/storage";

type Ctx = { params: Promise<{ key: string[] }> };

// Fichiers privés : servis uniquement avec une signature temporaire valide.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { key: parts } = await params;
  const key = parts.join("/");
  if (!verifyFileSignature(key, req.nextUrl.searchParams.get("exp"), req.nextUrl.searchParams.get("sig")))
    return new Response("Lien expiré ou invalide", { status: 403 });
  try {
    const buf = await readStoredFile(key);
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": mimeFromKey(key), "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex", "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Introuvable", { status: 404 });
  }
}
