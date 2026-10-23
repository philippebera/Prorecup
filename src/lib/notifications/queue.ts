import type { NotificationChannel } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { emailConfigured, pushConfigured, smsConfigured } from "../integrations";
import { NotConfiguredError, sendEmail, sendPush, sendSms } from "./providers";
import { APP_URL, BRAND_NAME } from "../brand";
import { issueClientAccessToken } from "../auth/core";
import { getSettings } from "../settings";

export const TRACKING_LINK = "{{TRACKING_LINK}}";

/** Les liens de suivi ne sont jamais stockés en clair : un jeton est émis au moment de l'envoi. */
async function renderBody(n: { body: string; requestId: string | null }) {
  if (!n.body.includes(TRACKING_LINK) || !n.requestId) return n.body;
  const settings = await getSettings();
  const token = await issueClientAccessToken(n.requestId, settings.clientLinkTtlHours);
  return n.body.replaceAll(TRACKING_LINK, `${APP_URL}/suivi/acces?t=${token}`);
}

type Db = Tx | typeof prisma;

export type NotificationInput = {
  channel: NotificationChannel;
  kind: string;
  dedupeKey: string;
  userId?: string | null;
  companyId?: string | null;
  requestId?: string | null;
  toAddress?: string | null;
  title: string;
  body: string;
  link?: string | null;
  notBefore?: Date;
};

export function channelConfigured(channel: NotificationChannel) {
  if (channel === "IN_APP") return true;
  if (channel === "EMAIL") return emailConfigured();
  if (channel === "SMS") return smsConfigured();
  return pushConfigured();
}

/**
 * Ajoute des notifications dans la file. Déduplication par dedupeKey (contrainte unique).
 * Un canal non configuré est enregistré avec le statut SKIPPED_NOT_CONFIGURED :
 * rien n'est annoncé comme envoyé.
 */
export async function enqueue(db: Db, items: NotificationInput[]) {
  if (!items.length) return 0;
  const res = await db.notification.createMany({
    skipDuplicates: true,
    data: items.map((n) => {
      const configured = channelConfigured(n.channel);
      const inApp = n.channel === "IN_APP";
      return {
        channel: n.channel,
        kind: n.kind,
        dedupeKey: n.dedupeKey,
        userId: n.userId ?? null,
        companyId: n.companyId ?? null,
        requestId: n.requestId ?? null,
        toAddress: n.toAddress ?? null,
        title: n.title,
        body: n.body,
        link: n.link ?? null,
        status: inApp ? "SENT" : configured ? "PENDING" : "SKIPPED_NOT_CONFIGURED",
        sentAt: inApp ? new Date() : null,
        lastError: configured ? null : "Service non configuré",
        nextAttemptAt: n.notBefore ?? new Date(),
      };
    }),
  });
  return res.count;
}

function hourInTz(date: Date, tz: string) {
  const part = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz }).formatToParts(date).find((p) => p.type === "hour");
  return Number(part?.value ?? 0);
}

/** Calcule la prochaine heure autorisée selon la plage de silence [start, end). */
export function nextAllowedTime(now: Date, quietStart: number | null, quietEnd: number | null, tz = process.env.APP_TIMEZONE || "Europe/Paris") {
  if (quietStart == null || quietEnd == null || quietStart === quietEnd) return now;
  const inQuiet = (h: number) => (quietStart < quietEnd ? h >= quietStart && h < quietEnd : h >= quietStart || h < quietEnd);
  let t = new Date(now);
  for (let i = 0; i < 48 && inQuiet(hourInTz(t, tz)); i++) {
    t = new Date(Math.floor(t.getTime() / 3600_000) * 3600_000 + 3600_000);
  }
  return t;
}

/** Notifie tous les utilisateurs d'une entreprise selon ses préférences. */
export async function notifyCompany(
  db: Db,
  companyId: string,
  n: { kind: string; key: string; title: string; body: string; link?: string; requestId?: string; sms?: boolean },
) {
  const company = await db.company.findUnique({
    where: { id: companyId },
    include: { members: { include: { user: { include: { pushSubscriptions: { select: { id: true } } } } } } },
  });
  if (!company) return;
  const notBefore = nextAllowedTime(new Date(), company.notifyQuietStart, company.notifyQuietEnd);
  const items: NotificationInput[] = [];
  for (const m of company.members) {
    const u = m.user;
    if (u.disabledAt || u.deletedAt) continue;
    const base = { kind: n.kind, userId: u.id, companyId, requestId: n.requestId, title: n.title, body: n.body, link: n.link };
    items.push({ ...base, channel: "IN_APP", dedupeKey: `${n.key}:inapp:${u.id}` });
    if (company.notifyEmail) items.push({ ...base, channel: "EMAIL", toAddress: u.email, dedupeKey: `${n.key}:email:${u.id}`, notBefore });
    if (company.notifyPush && u.pushSubscriptions.length) items.push({ ...base, channel: "PUSH", dedupeKey: `${n.key}:push:${u.id}`, notBefore });
  }
  // SMS : un seul par entreprise et par événement, uniquement si activé explicitement.
  if (n.sms && company.notifySms && company.smsPhone) {
    items.push({
      kind: n.kind, companyId, requestId: n.requestId, title: n.title, body: n.body, link: n.link,
      channel: "SMS", toAddress: company.smsPhone, dedupeKey: `${n.key}:sms:${companyId}`, notBefore,
    });
  }
  await enqueue(db, items);
}

const BACKOFF_MIN = [1, 5, 30, 120, 360];
export const MAX_ATTEMPTS = BACKOFF_MIN.length;

async function smsCapReached(companyId: string | null) {
  const since = new Date(Date.now() - 86400_000);
  const global = await prisma.notification.count({ where: { channel: "SMS", status: "SENT", sentAt: { gte: since } } });
  if (global >= Number(process.env.SMS_DAILY_CAP || 50)) return true;
  if (companyId) {
    const perCompany = await prisma.notification.count({ where: { channel: "SMS", status: "SENT", companyId, sentAt: { gte: since } } });
    if (perCompany >= Number(process.env.SMS_PER_COMPANY_DAILY_CAP || 5)) return true;
  }
  return false;
}

/** Traite la file (appelé par le worker ou /api/cron/notifications). */
export async function processQueue(limit = 50) {
  const claimed = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Notification" SET "attempts" = "attempts" + 1
    WHERE id IN (
      SELECT id FROM "Notification"
      WHERE status = 'PENDING' AND "nextAttemptAt" <= now()
      ORDER BY "nextAttemptAt" LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    ) RETURNING id`;
  let sent = 0;
  let failed = 0;
  for (const { id } of claimed) {
    const n = await prisma.notification.findUnique({ where: { id }, include: { user: { include: { pushSubscriptions: true } } } });
    if (!n) continue;
    try {
      if (n.channel === "EMAIL") {
        if (!n.toAddress) throw new Error("Adresse manquante");
        const link = n.link ? `\n\n${APP_URL}${n.link}` : "";
        await sendEmail(n.toAddress, `${BRAND_NAME} — ${n.title}`, `${await renderBody(n)}${link}\n\n— ${BRAND_NAME}`);
      } else if (n.channel === "SMS") {
        if (await smsCapReached(n.companyId)) {
          await prisma.notification.update({ where: { id }, data: { status: "SKIPPED_CAP", lastError: "Plafond SMS atteint" } });
          continue;
        }
        if (!n.toAddress) throw new Error("Numéro manquant");
        await sendSms(n.toAddress, `${BRAND_NAME} : ${n.title}. ${(await renderBody(n)).slice(0, 300)} ${n.link ? APP_URL + n.link : ""}`.trim());
      } else if (n.channel === "PUSH") {
        const subs = n.user?.pushSubscriptions ?? [];
        if (!subs.length) {
          await prisma.notification.update({ where: { id }, data: { status: "SKIPPED_PREFERENCE", lastError: "Aucun abonnement push" } });
          continue;
        }
        let ok = 0;
        for (const s of subs) {
          try {
            await sendPush(s, { title: n.title, body: n.body, url: n.link ?? "/" });
            ok++;
          } catch (e: unknown) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
            else throw e;
          }
        }
        if (!ok) throw new Error("Aucun abonnement push valide");
      }
      await prisma.notification.update({ where: { id }, data: { status: "SENT", sentAt: new Date(), lastError: null } });
      sent++;
    } catch (e) {
      failed++;
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof NotConfiguredError) {
        await prisma.notification.update({ where: { id }, data: { status: "SKIPPED_NOT_CONFIGURED", lastError: message } });
        continue;
      }
      const final = n.attempts >= MAX_ATTEMPTS;
      await prisma.notification.update({
        where: { id },
        data: {
          status: final ? "FAILED" : "PENDING",
          lastError: message.slice(0, 500),
          nextAttemptAt: new Date(Date.now() + BACKOFF_MIN[Math.min(n.attempts, MAX_ATTEMPTS - 1)] * 60_000),
        },
      });
    }
  }
  return { claimed: claimed.length, sent, failed };
}
