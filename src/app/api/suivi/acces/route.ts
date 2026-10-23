import { NextResponse, type NextRequest } from "next/server";
import { CLIENT_COOKIE, requestFromClientToken } from "@/lib/auth/core";
import { limit } from "@/lib/http";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

// Lien reçu par email/SMS : /suivi/acces?t=<jeton> → cookie httpOnly puis redirection
// (le jeton ne reste pas dans l'URL affichée ni dans l'historique de navigation suivant).
export async function GET(req: NextRequest) {
  try {
    await limit(req, "client-link", 30, 3600);
  } catch {
    return NextResponse.redirect(new URL("/suivi/lien?erreur=limite", req.url));
  }
  const t = req.nextUrl.searchParams.get("t") ?? "";
  const requestId = await requestFromClientToken(t);
  if (!requestId) return NextResponse.redirect(new URL("/suivi/lien?erreur=expire", req.url));
  const row = await prisma.clientAccessToken.findUnique({ where: { tokenHash: sha256(t) } });
  const res = NextResponse.redirect(new URL(`/suivi/${requestId}`, req.url));
  res.cookies.set(CLIENT_COOKIE, t, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    expires: row?.expiresAt,
  });
  res.headers.set("Referrer-Policy", "no-referrer");
  return res;
}
