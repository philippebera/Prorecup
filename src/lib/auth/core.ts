import { prisma } from "../db";
import { randomToken, sha256 } from "../crypto";

export const SESSION_COOKIE = "bd_session";
export const CLIENT_COOKIE = "bd_suivi";
export const SESSION_DAYS = 30;

export async function createSession(userId: string, meta?: { ip?: string; userAgent?: string }) {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, expiresAt, ip: meta?.ip, userAgent: meta?.userAgent?.slice(0, 300) },
  });
  await prisma.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  return { token, expiresAt };
}

export async function userFromSessionToken(token: string | undefined | null) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { include: { membership: { include: { company: true } } } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (u.disabledAt || u.deletedAt) return null;
  return u;
}

export async function destroySession(token: string | undefined | null) {
  if (!token) return;
  await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof userFromSessionToken>>>;

// --- Liens de suivi client --------------------------------------------------

export async function issueClientAccessToken(requestId: string, ttlHours: number) {
  const token = randomToken(32);
  await prisma.clientAccessToken.create({
    data: { requestId, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlHours * 3600_000) },
  });
  return token;
}

export async function requestFromClientToken(token: string | undefined | null) {
  if (!token) return null;
  const row = await prisma.clientAccessToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.revokedAt || row.expiresAt < new Date()) return null;
  await prisma.clientAccessToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
  return row.requestId;
}

export async function revokeClientTokens(requestId: string, exceptTokenHash?: string) {
  await prisma.clientAccessToken.updateMany({
    where: { requestId, revokedAt: null, ...(exceptTokenHash ? { NOT: { tokenHash: exceptTokenHash } } : {}) },
    data: { revokedAt: new Date() },
  });
}
