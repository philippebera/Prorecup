import { prisma, type Tx } from "./db";

// Paramètres de la plateforme, modifiables depuis l'administration.
export type SellerIdentity = {
  legalName: string;
  legalForm: string;
  address: string;
  siret: string;
  vatNumber: string;
  rcs: string;
  capital: string;
  email: string;
};

export type PlatformSettings = {
  welcomeCredits: number;
  maxUnlocksPerRequest: number;
  creditsPerUnlock: number;
  vatRateBp: number;
  claimWindowDays: number;
  unlockAccessDays: number;
  clientLinkTtlHours: number;
  maxRecipientsPerRequest: number;
  otpTtlMinutes: number;
  requestRetentionDays: number;
  invoicePrefix: string;
  seller: SellerIdentity;
  commercialPolicyValidated: boolean;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  welcomeCredits: 3,
  maxUnlocksPerRequest: 3,
  creditsPerUnlock: 1,
  vatRateBp: 2000,
  claimWindowDays: 7,
  unlockAccessDays: 365,
  clientLinkTtlHours: 72,
  maxRecipientsPerRequest: 30,
  otpTtlMinutes: 15,
  requestRetentionDays: 730,
  invoicePrefix: "F",
  // Identité de l'exploitant : volontairement vide, à compléter par l'exploitant.
  seller: { legalName: "", legalForm: "", address: "", siret: "", vatNumber: "", rcs: "", capital: "", email: "" },
  commercialPolicyValidated: false,
};

export async function getSettings(db: Tx | typeof prisma = prisma): Promise<PlatformSettings> {
  const rows = await db.platformSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (r.key in DEFAULT_SETTINGS) merged[r.key] = r.value;
  return merged as PlatformSettings;
}

export async function setSetting<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K], userId?: string) {
  await prisma.platformSetting.upsert({
    where: { key },
    create: { key, value: value as object, updatedBy: userId },
    update: { value: value as object, updatedBy: userId },
  });
}

export function sellerComplete(s: SellerIdentity): boolean {
  return Boolean(s.legalName && s.address && s.siret && s.email);
}
