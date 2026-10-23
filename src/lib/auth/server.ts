import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../db";
import { CLIENT_COOKIE, SESSION_COOKIE, requestFromClientToken, userFromSessionToken, type SessionUser } from "./core";
import { forbidden, unauthorized } from "../errors";

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  return userFromSessionToken(jar.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(token: string, expiresAt: Date) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

/** Pour les pages : redirige vers la connexion si nécessaire. */
export async function requirePageUser(role: "ADMIN" | "PROVIDER" | "CLIENT", next?: string) {
  const user = await getSessionUser();
  if (!user) redirect(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  if (user.role !== role) redirect("/connexion?erreur=role");
  return user;
}

export async function requirePageProvider(next?: string) {
  const user = await requirePageUser("PROVIDER", next);
  if (!user.membership) redirect("/loueur/inscription");
  return { user, company: user.membership.company, memberRole: user.membership.role };
}

/** Pour les API : lève une erreur 401/403. */
export async function requireApiUser(role?: "ADMIN" | "PROVIDER" | "CLIENT") {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (role && user.role !== role) throw forbidden();
  return user;
}

export async function requireApiProvider() {
  const user = await requireApiUser("PROVIDER");
  if (!user.membership) throw forbidden("Aucune entreprise rattachée");
  return { user, company: user.membership.company, memberRole: user.membership.role };
}

/**
 * Accès client à une demande : soit via le cookie de lien de suivi (jeton temporaire),
 * soit via un compte client propriétaire de la demande.
 */
export async function clientRequestIds(): Promise<string[]> {
  const jar = await cookies();
  const ids = new Set<string>();
  const fromToken = await requestFromClientToken(jar.get(CLIENT_COOKIE)?.value);
  if (fromToken) ids.add(fromToken);
  const user = await userFromSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (user?.role === "CLIENT") {
    const owned = await prisma.request.findMany({ where: { clientUserId: user.id }, select: { id: true } });
    owned.forEach((r) => ids.add(r.id));
  }
  return [...ids];
}

export async function requireClientRequest(requestId: string) {
  const ids = await clientRequestIds();
  if (!ids.includes(requestId)) throw forbidden("Lien de suivi expiré ou invalide");
  return requestId;
}
