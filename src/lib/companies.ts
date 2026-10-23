import { z } from "zod";
import { prisma } from "./db";
import { AppError, notFound } from "./errors";
import { hashPassword, randomToken, sha256 } from "./crypto";
import { isValidSiret, normalizeSiret, sirenOf } from "./siret";
import { departmentFromPostalCode, DEPARTMENTS } from "./geo";
import { SERVICES, SKIP_SIZES_M3, WASTE_TYPES } from "./catalog";
import { applyLedger } from "./credits";
import { getSettings } from "./settings";
import { audit } from "./audit";
import { notifyCompany } from "./notifications/queue";

const phoneRe = /^(?:\+33\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/;

export const companyProfileSchema = z.object({
  legalName: z.string().trim().min(2).max(150),
  tradeName: z.string().trim().max(150).optional().nullable(),
  vatNumber: z.string().trim().max(20).optional().nullable(),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().regex(phoneRe, "Téléphone invalide"),
  website: z.string().trim().url().max(200).optional().nullable().or(z.literal("")),
  addressLine: z.string().trim().min(3).max(200),
  postalCode: z.string().trim().regex(/^\d{5}$/),
  city: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1500).optional().nullable(),
  skipSizesM3: z.array(z.number().int().refine((n) => SKIP_SIZES_M3.includes(n))).min(1, "Indiquez au moins une taille"),
  wasteTypes: z.array(z.string().refine((c) => WASTE_TYPES.some((w) => w.code === c))).min(1, "Indiquez au moins un type de déchets"),
  services: z.array(z.string().refine((c) => SERVICES.some((s) => s.code === c))).default([]),
  departments: z.array(z.string().refine((d) => d in DEPARTMENTS)).min(1, "Indiquez au moins un département desservi"),
  postalCodes: z.array(z.string().regex(/^\d{5}$/)).default([]),
  openingHours: z.string().trim().max(300).optional().nullable(),
  availabilityNote: z.string().trim().max(300).optional().nullable(),
  publicProfile: z.boolean().default(true),
});

export const registerSchema = companyProfileSchema.extend({
  siret: z.string().refine(isValidSiret, "SIRET invalide (14 chiffres, clé de contrôle)"),
  ownerName: z.string().trim().min(2).max(100),
  ownerEmail: z.string().trim().toLowerCase().email(),
  ownerPhone: z.string().trim().regex(phoneRe).optional().nullable(),
  password: z.string().min(10, "10 caractères minimum").max(200),
  establishmentName: z.string().trim().max(150).optional().nullable(),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Acceptation des conditions requise" }) }),
});

function slugify(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60);
}

function zonesData(departments: string[], postalCodes: string[]) {
  const zones = departments.map((d) => ({ departmentCode: d, postalCode: null as string | null }));
  for (const pc of postalCodes) {
    const d = departmentFromPostalCode(pc);
    if (d && !departments.includes(d)) zones.push({ departmentCode: d, postalCode: pc });
  }
  return zones;
}

/** Signaux de doublon (même SIREN, même téléphone, même email, même domaine). */
export async function detectDuplicates(input: { siren: string; email: string; phone: string; ownerEmail?: string }, excludeId?: string) {
  const flags: string[] = [];
  const not = excludeId ? { NOT: { id: excludeId } } : {};
  const domain = input.email.split("@")[1];
  const generic = ["gmail.com", "hotmail.com", "hotmail.fr", "outlook.com", "outlook.fr", "yahoo.fr", "yahoo.com", "orange.fr", "free.fr", "sfr.fr", "laposte.net", "wanadoo.fr", "icloud.com"];
  const [bySiren, byPhone, byEmail, byDomain] = await Promise.all([
    prisma.company.count({ where: { siren: input.siren, ...not } }),
    prisma.company.count({ where: { phone: input.phone, ...not } }),
    prisma.company.count({ where: { email: input.email, ...not } }),
    domain && !generic.includes(domain) ? prisma.company.count({ where: { email: { endsWith: `@${domain}` }, ...not } }) : Promise.resolve(0),
  ]);
  if (bySiren) flags.push("SAME_SIREN");
  if (byPhone) flags.push("SAME_PHONE");
  if (byEmail) flags.push("SAME_EMAIL");
  if (byDomain) flags.push("SAME_EMAIL_DOMAIN");
  return flags;
}

export async function registerCompany(raw: unknown) {
  const input = registerSchema.parse(raw);
  const siret = normalizeSiret(input.siret);
  const siren = sirenOf(siret);
  if (await prisma.company.findUnique({ where: { siret } })) throw new AppError("SIRET_TAKEN", "Un compte existe déjà pour ce SIRET. Demandez une invitation à son administrateur.", 409);
  if (await prisma.user.findUnique({ where: { email: input.ownerEmail } })) throw new AppError("EMAIL_TAKEN", "Un compte existe déjà avec cet email", 409);
  const phone = input.phone.replace(/[\s.-]/g, "");
  const flags = await detectDuplicates({ siren, email: input.email, phone });
  let slug = slugify(`${input.tradeName || input.legalName}-${input.city}`);
  if (await prisma.company.findUnique({ where: { slug } })) slug = `${slug}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, "")}`;

  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: {
        slug, legalName: input.legalName, tradeName: input.tradeName || null, siret, siren, vatNumber: input.vatNumber || null,
        email: input.email, phone, website: input.website || null, addressLine: input.addressLine, postalCode: input.postalCode,
        city: input.city, description: input.description || null, skipSizesM3: input.skipSizesM3, wasteTypes: input.wasteTypes,
        services: input.services, openingHours: input.openingHours || null, availabilityNote: input.availabilityNote || null,
        publicProfile: input.publicProfile, duplicateFlags: flags, billingName: input.legalName, billingEmail: input.email,
        billingAddress: input.addressLine, billingPostalCode: input.postalCode, billingCity: input.city,
        zones: { create: zonesData(input.departments, input.postalCodes) },
        establishments: { create: { name: input.establishmentName || "Établissement principal", addressLine: input.addressLine, postalCode: input.postalCode, city: input.city } },
        wallet: { create: { balance: 0 } },
      },
    });
    const user = await tx.user.create({
      data: { email: input.ownerEmail, name: input.ownerName, phone: input.ownerPhone || null, role: "PROVIDER", passwordHash, membership: { create: { companyId: company.id, role: "OWNER" } } },
    });
    await audit({ actorUserId: user.id, actorType: "PROVIDER", action: "COMPANY_REGISTERED", entityType: "Company", entityId: company.id, data: { flags } }, tx);
    return { company, user };
  });
}

export async function updateCompanyProfile(companyId: string, raw: unknown, actorUserId: string) {
  const input = companyProfileSchema.parse(raw);
  await prisma.$transaction(async (tx) => {
    await tx.company.update({
      where: { id: companyId },
      data: {
        legalName: input.legalName, tradeName: input.tradeName || null, vatNumber: input.vatNumber || null, email: input.email,
        phone: input.phone.replace(/[\s.-]/g, ""), website: input.website || null, addressLine: input.addressLine, postalCode: input.postalCode,
        city: input.city, description: input.description || null, skipSizesM3: input.skipSizesM3, wasteTypes: input.wasteTypes,
        services: input.services, openingHours: input.openingHours || null, availabilityNote: input.availabilityNote || null, publicProfile: input.publicProfile,
      },
    });
    await tx.serviceZone.deleteMany({ where: { companyId } });
    await tx.serviceZone.createMany({ data: zonesData(input.departments, input.postalCodes).map((z) => ({ ...z, companyId })) });
    await audit({ actorUserId, actorType: "PROVIDER", action: "COMPANY_UPDATED", entityType: "Company", entityId: companyId }, tx);
  });
}

/**
 * Validation par l'administration. Les crédits de découverte sont attribués une
 * seule fois par SIREN (table WelcomeGrant, clé primaire = SIREN) et la référence
 * du registre est unique : une seconde validation ou un second compte de la
 * même entreprise ne reçoit rien.
 */
export async function approveCompany(companyId: string, adminId: string, opts: { grantWelcome?: boolean; note?: string } = {}) {
  const settings = await getSettings();
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.findUnique({ where: { id: companyId } });
    if (!company) throw notFound("Entreprise");
    await tx.company.update({ where: { id: companyId }, data: { status: "APPROVED", approvedAt: company.approvedAt ?? new Date(), statusReason: opts.note || null } });
    let granted = 0;
    if (opts.grantWelcome !== false && settings.welcomeCredits > 0) {
      const inserted = await tx.$executeRaw`INSERT INTO "WelcomeGrant" ("siren", "companyId", "createdAt") VALUES (${company.siren}, ${companyId}, now()) ON CONFLICT DO NOTHING`;
      if (inserted === 1) {
        const res = await applyLedger(tx, {
          companyId, type: "WELCOME", amount: settings.welcomeCredits, reference: `welcome:${company.siren}`,
          reason: "Crédits de découverte", actorUserId: adminId,
        });
        if (!res.duplicate) granted = settings.welcomeCredits;
      }
    }
    await audit({ actorUserId: adminId, actorType: "ADMIN", action: "COMPANY_APPROVED", entityType: "Company", entityId: companyId, data: { granted, note: opts.note } }, tx);
    await notifyCompany(tx, companyId, {
      kind: "COMPANY_APPROVED", key: `approved:${companyId}:${Date.now()}`, title: "Votre entreprise est validée",
      body: granted ? `Vous pouvez débloquer des contacts. ${granted} crédits de découverte ont été ajoutés.` : "Vous pouvez débloquer des contacts.",
      link: "/loueur",
    });
    return { granted };
  });
}

export async function setCompanyStatus(companyId: string, status: "SUSPENDED" | "REJECTED" | "PENDING", adminId: string, reason: string) {
  if (reason.trim().length < 3) throw new AppError("REASON_REQUIRED", "Motif requis");
  await prisma.$transaction(async (tx) => {
    await tx.company.update({ where: { id: companyId }, data: { status, statusReason: reason } });
    await audit({ actorUserId: adminId, actorType: "ADMIN", action: `COMPANY_${status}`, entityType: "Company", entityId: companyId, data: { reason } }, tx);
  });
}

export async function recordVerification(companyId: string, field: string, method: string, adminId: string, note?: string) {
  await prisma.companyVerification.upsert({
    where: { companyId_field: { companyId, field } },
    create: { companyId, field, method, note, verifiedById: adminId },
    update: { method, note, verifiedById: adminId, verifiedAt: new Date() },
  });
  await audit({ actorUserId: adminId, actorType: "ADMIN", action: "COMPANY_VERIFIED_FIELD", entityType: "Company", entityId: companyId, data: { field, method } });
}

// --- Utilisateurs de l'entreprise ------------------------------------------

export async function inviteMember(companyId: string, email: string, invitedById: string) {
  const e = email.trim().toLowerCase();
  if (await prisma.user.findUnique({ where: { email: e } })) throw new AppError("EMAIL_TAKEN", "Cet email est déjà utilisé", 409);
  const token = randomToken(24);
  await prisma.companyInvitation.create({ data: { companyId, email: e, tokenHash: sha256(token), invitedById, expiresAt: new Date(Date.now() + 7 * 86400_000) } });
  return token;
}

export async function acceptInvitation(token: string, input: { name: string; password: string }) {
  if (input.password.length < 10) throw new AppError("WEAK_PASSWORD", "10 caractères minimum");
  const inv = await prisma.companyInvitation.findUnique({ where: { tokenHash: sha256(token) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) throw new AppError("INVALID_INVITATION", "Invitation invalide ou expirée");
  const passwordHash = await hashPassword(input.password);
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: inv.email, name: input.name, role: "PROVIDER", passwordHash, emailVerifiedAt: new Date(), membership: { create: { companyId: inv.companyId, role: "MEMBER" } } },
    });
    await tx.companyInvitation.update({ where: { id: inv.id }, data: { acceptedAt: new Date() } });
    return user;
  });
}
