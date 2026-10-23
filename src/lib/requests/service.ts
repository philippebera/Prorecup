import type { ContactChannel, Prisma } from "@prisma/client";
import { prisma, type Tx } from "../db";
import { AppError, forbidden, notFound } from "../errors";
import { hmac, otpCode, randomToken, safeEqual, sha256 } from "../crypto";
import { departmentFromPostalCode, departmentName } from "../geo";
import { getSettings } from "../settings";
import { devOtpLogging, emailConfigured, smsConfigured } from "../integrations";
import { sendEmail, sendSms, toE164 } from "../notifications/providers";
import { enqueue, notifyCompany } from "../notifications/queue";
import { issueClientAccessToken } from "../auth/core";
import { wasteLabel } from "../catalog";
import { BRAND_NAME } from "../brand";
import { channelsLabel, contactConsentText, type CreateRequestInput } from "./schema";
import { audit } from "../audit";

function publicRef() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomToken(8);
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[bytes.charCodeAt(i) % alphabet.length];
  return `BD-${out}`;
}

export function contactFingerprint(email?: string | null, phone?: string | null) {
  const parts = [email?.trim().toLowerCase() ?? "", phone ? (toE164(phone) ?? phone) : ""];
  return sha256(`fp:${parts.join("|")}`);
}

/** Étape 1 : enregistre la demande en brouillon et émet un lien de suivi. */
export async function createDraft(input: CreateRequestInput, meta: { ipHash?: string } = {}) {
  const settings = await getSettings();
  const dep = departmentFromPostalCode(input.postalCode)!;
  const wantsEmail = input.contactPreference !== "PHONE";
  const wantsPhone = input.contactPreference !== "EMAIL";
  const request = await prisma.request.create({
    data: {
      publicRef: publicRef(),
      status: "DRAFT",
      clientType: input.clientType,
      companyName: input.clientType === "PROFESSIONAL" ? input.companyName : null,
      addressLine: input.addressLine,
      addressComplement: input.addressComplement || null,
      postalCode: input.postalCode,
      city: input.city,
      departmentCode: dep,
      startDate: new Date(`${input.startDate}T00:00:00Z`),
      endDate: input.endDate ? new Date(`${input.endDate}T00:00:00Z`) : null,
      flexibleDates: input.flexibleDates,
      urgent: input.urgent,
      wasteTypes: input.wasteTypes,
      wasteNotes: input.wasteNotes || null,
      volumeM3: input.volumeM3,
      placement: input.placement,
      accessFlags: input.accessFlags,
      accessDetails: input.accessDetails || null,
      contactPreference: input.contactPreference,
      contactName: input.contactName,
      email: wantsEmail ? input.email : null,
      phone: wantsPhone ? (toE164(input.phone!) ?? input.phone) : null,
      callbackHours: input.callbackSlots.join(",") || null,
      maxUnlocks: settings.maxUnlocksPerRequest,
      ipHash: meta.ipHash,
      fingerprint: contactFingerprint(wantsEmail ? input.email : null, wantsPhone ? input.phone : null),
    },
  });
  if (input.placement === "PUBLIC_ROAD") {
    await prisma.permit.create({
      data: {
        requestId: request.id,
        startDate: request.startDate,
        endDate: request.endDate,
        applicantName: input.clientType === "PROFESSIONAL" ? input.companyName : input.contactName,
      },
    });
  }
  const token = await issueClientAccessToken(request.id, settings.clientLinkTtlHours);
  return { request, token };
}

function codeHash(requestId: string, channel: ContactChannel, code: string) {
  return hmac(`otp:${requestId}:${channel}:${code}`);
}

export function channelAvailable(channel: ContactChannel) {
  return channel === "EMAIL" ? emailConfigured() || devOtpLogging() : smsConfigured() || devOtpLogging();
}

/**
 * Envoie un code de vérification. Si aucun fournisseur n'est configuré, l'envoi
 * échoue (aucun envoi n'est simulé) ; en développement uniquement, le code peut
 * être écrit dans la console du serveur (DEV_LOG_OTP=true).
 */
export async function sendVerificationCode(requestId: string, channel: ContactChannel) {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) throw notFound("Demande");
  if (r.status !== "DRAFT") throw new AppError("NOT_DRAFT", "Cette demande est déjà diffusée");
  const target = channel === "EMAIL" ? r.email : r.phone;
  if (!target) throw new AppError("NO_TARGET", "Ce canal n'a pas été choisi");
  if ((channel === "EMAIL" && r.emailVerifiedAt) || (channel === "PHONE" && r.phoneVerifiedAt)) return { alreadyVerified: true, delivery: "none" as const };

  const recent = await prisma.verificationCode.count({ where: { requestId, channel, createdAt: { gte: new Date(Date.now() - 3600_000) } } });
  if (recent >= 5) throw new AppError("RATE_LIMITED", "Trop de codes demandés. Réessayez dans une heure.", 429);

  const settings = await getSettings();
  const code = otpCode();
  await prisma.verificationCode.create({
    data: { requestId, channel, target, codeHash: codeHash(requestId, channel, code), expiresAt: new Date(Date.now() + settings.otpTtlMinutes * 60_000) },
  });

  const configured = channel === "EMAIL" ? emailConfigured() : smsConfigured();
  const text = `Votre code de vérification ${BRAND_NAME} : ${code}. Il expire dans ${settings.otpTtlMinutes} minutes.`;
  const historyKey = `otp:${requestId}:${channel}:${Date.now()}`;
  if (configured) {
    try {
      if (channel === "EMAIL") await sendEmail(target, `${BRAND_NAME} — code de vérification`, text);
      else await sendSms(target, text);
      await enqueue(prisma, [{ channel: channel === "EMAIL" ? "EMAIL" : "SMS", kind: "OTP", dedupeKey: historyKey, requestId, toAddress: target, title: "Code de vérification", body: "Code envoyé (non conservé)" }]);
      await prisma.notification.update({ where: { dedupeKey: historyKey }, data: { status: "SENT", sentAt: new Date() } });
      return { alreadyVerified: false, delivery: "sent" as const };
    } catch (e) {
      throw new AppError("SEND_FAILED", `L'envoi du code a échoué : ${(e as Error).message}`, 502);
    }
  }
  if (devOtpLogging()) {
    console.info(`[DEV] Code ${channel} pour ${r.publicRef} (${target}) : ${code}`);
    return { alreadyVerified: false, delivery: "dev-console" as const };
  }
  throw new AppError(
    "CHANNEL_NOT_CONFIGURED",
    channel === "EMAIL"
      ? "La vérification par email n'est pas disponible pour le moment (service non configuré)."
      : "La vérification par SMS n'est pas disponible pour le moment (service non configuré). Choisissez le contact par email.",
    503,
  );
}

export async function verifyCode(requestId: string, channel: ContactChannel, code: string) {
  const vc = await prisma.verificationCode.findFirst({
    where: { requestId, channel, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!vc || vc.expiresAt < new Date()) throw new AppError("CODE_EXPIRED", "Code expiré : demandez un nouveau code");
  if (vc.attempts >= 5) throw new AppError("TOO_MANY_ATTEMPTS", "Trop d'essais : demandez un nouveau code", 429);
  await prisma.verificationCode.update({ where: { id: vc.id }, data: { attempts: { increment: 1 } } });
  if (!safeEqual(vc.codeHash, codeHash(requestId, channel, code.trim()))) throw new AppError("CODE_INVALID", "Code incorrect");
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  const current = channel === "EMAIL" ? r?.email : r?.phone;
  if (current !== vc.target) throw new AppError("TARGET_CHANGED", "Les coordonnées ont changé : demandez un nouveau code");
  await prisma.$transaction([
    prisma.verificationCode.update({ where: { id: vc.id }, data: { consumedAt: new Date() } }),
    prisma.request.update({ where: { id: requestId }, data: channel === "EMAIL" ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() } }),
  ]);
  return { verified: true };
}

export function channelsVerified(r: { contactPreference: string; emailVerifiedAt: Date | null; phoneVerifiedAt: Date | null }) {
  const emailOk = r.contactPreference === "PHONE" || Boolean(r.emailVerifiedAt);
  const phoneOk = r.contactPreference === "EMAIL" || Boolean(r.phoneVerifiedAt);
  return emailOk && phoneOk;
}

// ---------------------------------------------------------------------------
// Sélection des loueurs
// ---------------------------------------------------------------------------

export async function findMatchingCompanies(
  db: Tx | typeof prisma,
  r: { departmentCode: string; postalCode: string; wasteTypes: string[]; volumeM3: number | null; placement: string; isDemo: boolean },
  limit: number,
) {
  const where: Prisma.CompanyWhereInput = {
    status: "APPROVED",
    // Les données de démonstration sont isolées : jamais mélangées aux vraies demandes.
    isDemo: r.isDemo,
    zones: { some: { departmentCode: r.departmentCode, OR: [{ postalCode: null }, { postalCode: r.postalCode }] } },
    wasteTypes: { hasEvery: r.wasteTypes },
    ...(r.placement === "PUBLIC_ROAD" ? { services: { has: "PUBLIC_ROAD" } } : {}),
  };
  const candidates = await db.company.findMany({
    where,
    select: { id: true, slug: true, legalName: true, tradeName: true, city: true, skipSizesM3: true, isDemo: true },
  });
  const filtered = candidates.filter((c) => r.volumeM3 == null || c.skipSizesM3.some((s) => s >= r.volumeM3!));
  // Rotation équitable : les entreprises les moins sollicitées sur 30 jours d'abord.
  const counts = await db.requestRecipient.groupBy({
    by: ["companyId"],
    where: { companyId: { in: filtered.map((c) => c.id) }, notifiedAt: { gte: new Date(Date.now() - 30 * 86400_000) } },
    _count: true,
  });
  const load = new Map(counts.map((c) => [c.companyId, c._count]));
  return filtered.sort((a, b) => (load.get(a.id) ?? 0) - (load.get(b.id) ?? 0)).slice(0, limit);
}

/** Calcule et enregistre les destinataires présentés au client avant diffusion. */
export async function prepareRecipients(requestId: string) {
  const r = await prisma.request.findUnique({ where: { id: requestId } });
  if (!r) throw notFound("Demande");
  if (r.status !== "DRAFT") throw new AppError("NOT_DRAFT", "Demande déjà diffusée");
  if (!channelsVerified(r)) throw new AppError("NOT_VERIFIED", "Vérifiez d'abord vos coordonnées");
  const settings = await getSettings();
  const companies = await findMatchingCompanies(prisma, r, settings.maxRecipientsPerRequest);
  await prisma.$transaction([
    prisma.requestRecipient.deleteMany({ where: { requestId, notifiedAt: null } }),
    prisma.requestRecipient.createMany({ data: companies.map((c) => ({ requestId, companyId: c.id })), skipDuplicates: true }),
  ]);
  return companies.map((c) => ({ id: c.id, slug: c.slug, name: c.tradeName || c.legalName, city: c.city }));
}

/** Diffusion : consentement explicite, canaux vérifiés, destinataires validés. */
export async function publishRequest(requestId: string, input: { contactConsent: boolean; marketingConsent: boolean }) {
  if (!input.contactConsent) throw new AppError("CONSENT_REQUIRED", "Votre accord pour être contacté(e) est nécessaire");
  const settings = await getSettings();
  const result = await prisma.$transaction(async (tx) => {
    const [locked] = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Request" WHERE id = ${requestId} FOR UPDATE`;
    if (!locked) throw notFound("Demande");
    const r = await tx.request.findUniqueOrThrow({ where: { id: requestId } });
    if (r.status !== "DRAFT") throw new AppError("NOT_DRAFT", "Demande déjà diffusée");
    if (!channelsVerified(r)) throw new AppError("NOT_VERIFIED", "Vérifiez d'abord vos coordonnées");
    const recipients = await tx.requestRecipient.findMany({
      where: { requestId, company: { status: "APPROVED" } },
      include: { company: { select: { id: true } } },
    });
    if (!recipients.length) throw new AppError("NO_RECIPIENT", "Aucune entreprise ne correspond pour le moment à votre demande");
    const now = new Date();
    await tx.request.update({
      where: { id: requestId },
      data: {
        status: "PUBLISHED",
        publishedAt: now,
        maxUnlocks: settings.maxUnlocksPerRequest,
        contactConsentAt: now,
        contactConsentText: contactConsentText(channelsLabel(r.contactPreference), settings.maxUnlocksPerRequest),
        marketingConsent: input.marketingConsent,
        marketingConsentAt: input.marketingConsent ? now : null,
      },
    });
    await tx.requestRecipient.updateMany({ where: { requestId, companyId: { in: recipients.map((x) => x.companyId) } }, data: { notifiedAt: now } });
    await tx.requestRecipient.deleteMany({ where: { requestId, notifiedAt: null } });

    // Notification sans coordonnées ni adresse exacte.
    const dates = `${r.startDate.toISOString().slice(0, 10)}${r.flexibleDates ? " (flexible)" : ""}`;
    const body = `${r.city} (${departmentName(r.departmentCode)}) · ${r.wasteTypes.map(wasteLabel).join(", ")} · ${r.volumeM3 ? r.volumeM3 + " m³" : "volume à définir"} · pose souhaitée ${dates}`;
    for (const rec of recipients) {
      await notifyCompany(tx, rec.companyId, {
        kind: "NEW_REQUEST",
        key: `newreq:${requestId}:${rec.companyId}`,
        title: r.urgent ? "Nouvelle demande urgente" : "Nouvelle demande de benne",
        body,
        link: `/loueur/demandes/${requestId}`,
        requestId,
        sms: true,
      });
    }
    await audit({ actorType: "CLIENT", action: "REQUEST_PUBLISHED", entityType: "Request", entityId: requestId, data: { recipients: recipients.length } }, tx);
    return { recipients: recipients.length, publicRef: r.publicRef, email: r.emailVerifiedAt ? r.email : null };
  });
  if (result.email) {
    await enqueue(prisma, [
      {
        channel: "EMAIL", kind: "CLIENT_PUBLISHED", dedupeKey: `client-published:${requestId}`, requestId, toAddress: result.email,
        title: `Votre demande ${result.publicRef} est diffusée`,
        body: `Votre demande a été transmise à ${result.recipients} entreprise(s). ${settings.maxUnlocksPerRequest} entreprises au maximum pourront obtenir vos coordonnées.\nSuivre votre demande (lien valable ${settings.clientLinkTtlHours} h) : {{TRACKING_LINK}}`,
      },
    ]);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Actions du client
// ---------------------------------------------------------------------------

const CLOSED_STATUSES = ["FULFILLED", "CLOSED", "CANCELLED", "ARCHIVED"];

async function notifyUnlockers(tx: Tx, requestId: string, title: string, body: string, key: string) {
  const unlocks = await tx.unlock.findMany({ where: { requestId }, select: { companyId: true } });
  for (const u of unlocks)
    await notifyCompany(tx, u.companyId, { kind: "REQUEST_STATUS", key: `${key}:${u.companyId}`, title, body, link: `/loueur/demandes/${requestId}`, requestId });
}

export async function clientSetStatus(
  requestId: string,
  action: "pause" | "resume" | "close" | "cancel" | "fulfilled",
  opts: { reason?: string; chosenCompanyId?: string | null } = {},
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Request" WHERE id = ${requestId} FOR UPDATE`;
    const r = await tx.request.findUnique({ where: { id: requestId } });
    if (!r) throw notFound("Demande");
    if (CLOSED_STATUSES.includes(r.status)) throw new AppError("ALREADY_CLOSED", "Cette demande est déjà clôturée");
    const now = new Date();
    let data: Prisma.RequestUpdateInput;
    switch (action) {
      case "pause":
        if (r.status !== "PUBLISHED") throw new AppError("INVALID_STATE", "Demande non diffusée");
        data = { status: "PAUSED", pausedAt: now };
        break;
      case "resume":
        if (r.status !== "PAUSED") throw new AppError("INVALID_STATE", "Demande non suspendue");
        data = { status: "PUBLISHED", pausedAt: null };
        break;
      case "close":
        data = { status: "CLOSED", closedAt: now, closeReason: opts.reason?.slice(0, 300) || null };
        break;
      case "cancel":
        data = { status: "CANCELLED", closedAt: now, closeReason: opts.reason?.slice(0, 300) || null };
        break;
      case "fulfilled": {
        let chosen: string | null = null;
        if (opts.chosenCompanyId) {
          const ok = await tx.unlock.findUnique({ where: { requestId_companyId: { requestId, companyId: opts.chosenCompanyId } } });
          if (!ok) throw forbidden("Entreprise inconnue pour cette demande");
          chosen = opts.chosenCompanyId;
          await tx.offer.updateMany({ where: { requestId, companyId: chosen, status: "SENT" }, data: { status: "CHOSEN" } });
        }
        data = { status: "FULFILLED", closedAt: now, chosenCompany: chosen ? { connect: { id: chosen } } : undefined };
        break;
      }
    }
    const updated = await tx.request.update({ where: { id: requestId }, data });
    if (action !== "resume") {
      const label = { pause: "ne souhaite plus de nouveaux contacts", close: "a fermé sa demande", cancel: "a annulé sa demande", fulfilled: "a trouvé un loueur" }[action];
      await notifyUnlockers(tx, requestId, `Demande ${r.publicRef} : mise à jour`, `Le client ${label}.`, `status:${action}:${requestId}`);
    }
    await audit({ actorType: "CLIENT", action: `REQUEST_${action.toUpperCase()}`, entityType: "Request", entityId: requestId }, tx);
    return updated;
  });
}

export async function clientReport(requestId: string, input: { reason: string; message: string; companyId?: string | null }) {
  if (input.companyId) {
    const ok = await prisma.unlock.findUnique({ where: { requestId_companyId: { requestId, companyId: input.companyId } } });
    if (!ok) throw forbidden();
  }
  return prisma.clientReport.create({
    data: { requestId, reason: input.reason.slice(0, 50), message: input.message.slice(0, 2000), companyId: input.companyId || null },
  });
}

/** Données visibles par le client lui-même dans son espace de suivi. */
export async function getClientView(requestId: string) {
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: {
      recipients: { where: { OR: [{ notifiedAt: { not: null } }, { request: { status: "DRAFT" } }] }, include: { company: { select: { id: true, slug: true, legalName: true, tradeName: true, city: true, publicProfile: true, status: true } } } },
      unlocks: { include: { company: { select: { id: true, slug: true, legalName: true, tradeName: true, phone: true, email: true, website: true, city: true } } }, orderBy: { createdAt: "asc" } },
      offers: { where: { status: { not: "WITHDRAWN" } }, include: { company: { select: { id: true, legalName: true, tradeName: true } } }, orderBy: { createdAt: "desc" } },
      photos: { select: { id: true, storageKey: true, mimeType: true } },
      permit: { select: { id: true, status: true } },
      reports: { select: { id: true, reason: true, status: true, createdAt: true } },
    },
  });
  if (!r) throw notFound("Demande");
  return r;
}

/** Demande d'un nouveau lien de suivi : réponse identique que la demande existe ou non. */
export async function resendTrackingLink(identifier: string) {
  const id = identifier.trim().toLowerCase();
  const phone = toE164(id);
  const r = await prisma.request.findFirst({
    where: phone ? { phone, phoneVerifiedAt: { not: null } } : { email: id, emailVerifiedAt: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  if (!r) return;
  const settings = await getSettings();
  const link = "{{TRACKING_LINK}}";
  await enqueue(prisma, [
    phone
      ? { channel: "SMS", kind: "CLIENT_LINK", dedupeKey: `link:${r.id}:${Date.now()}`, requestId: r.id, toAddress: r.phone, title: "Lien de suivi", body: link }
      : { channel: "EMAIL", kind: "CLIENT_LINK", dedupeKey: `link:${r.id}:${Date.now()}`, requestId: r.id, toAddress: r.email, title: `Votre lien de suivi ${r.publicRef}`, body: `Accédez à votre demande (lien valable ${settings.clientLinkTtlHours} h) : ${link}` },
  ]);
}
