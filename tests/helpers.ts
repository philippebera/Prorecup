import { vi } from "vitest";
import { prisma } from "@/lib/db";
import { registerCompany, approveCompany } from "@/lib/companies";
import { createDraft, sendVerificationCode, verifyCode, prepareRecipients, publishRequest } from "@/lib/requests/service";
import type { CreateRequestInput } from "@/lib/requests/schema";
import { createRequestSchema } from "@/lib/requests/schema";

let n = 0;
function luhnSiret(base: string) {
  // complète une base de 13 chiffres avec la clé de Luhn
  for (let d = 0; d <= 9; d++) {
    const s = base + d;
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      let x = Number(s[13 - i]);
      if (i % 2 === 1) { x *= 2; if (x > 9) x -= 9; }
      sum += x;
    }
    if (sum % 10 === 0) return s;
  }
  throw new Error("luhn");
}

export function uniqueSiret(sirenOverride?: string) {
  n++;
  const siren = sirenOverride ?? String(100000000 + Math.floor(Math.random() * 800000000)).slice(0, 9);
  return luhnSiret(siren + String(n % 10000).padStart(4, "0"));
}

export async function admin() {
  return prisma.user.upsert({ where: { email: "admin@test.invalid" }, create: { email: "admin@test.invalid", name: "Admin", role: "ADMIN" }, update: {} });
}

export async function makeCompany(opts: { approve?: boolean; siret?: string; deps?: string[]; waste?: string[]; sizes?: number[]; services?: string[] } = {}) {
  n++;
  const { company, user } = await registerCompany({
    legalName: `Loueur Test ${n}`,
    siret: opts.siret ?? uniqueSiret(),
    email: `contact${n}@loueur${n}.test`,
    phone: `06${String(10000000 + n).slice(-8)}`,
    addressLine: "1 rue du Dépôt",
    postalCode: "69003",
    city: "Lyon",
    skipSizesM3: opts.sizes ?? [8, 10, 15],
    wasteTypes: opts.waste ?? ["GRAVATS", "DIB", "VERTS"],
    services: opts.services ?? ["PUBLIC_ROAD"],
    departments: opts.deps ?? ["69"],
    ownerName: "Patron Test",
    ownerEmail: `owner${n}@loueur${n}.test`,
    password: "motdepasse-solide",
    acceptTerms: true,
  });
  if (opts.approve !== false) await approveCompany(company.id, (await admin()).id);
  return { company, user };
}

export async function addMember(companyId: string) {
  n++;
  return prisma.user.create({ data: { email: `member${n}@test.invalid`, name: "Membre", role: "PROVIDER", membership: { create: { companyId, role: "MEMBER" } } } });
}

export function requestInput(over: Partial<CreateRequestInput> = {}): CreateRequestInput {
  const start = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
  return createRequestSchema.parse({
    clientType: "INDIVIDUAL",
    addressLine: "12 rue Secrète",
    postalCode: "69003",
    city: "Lyon",
    startDate: start,
    endDate: null,
    flexibleDates: false,
    urgent: false,
    wasteTypes: ["GRAVATS"],
    wasteNotes: "Appelez-moi au 0611223344",
    volumeM3: 8,
    placement: "PRIVATE",
    accessFlags: ["NARROW_STREET"],
    accessDetails: "Code portail 1234",
    contactPreference: "BOTH",
    contactName: "Jeanne Secret",
    email: `jeanne.${Date.now()}.${Math.random().toString(36).slice(2)}@client.test`,
    phone: "06 11 22 33 44",
    callbackSlots: ["MORNING"],
    ...over,
  });
}

/** Envoie et valide un code en lisant la console de développement. */
export async function verifyChannel(requestId: string, channel: "EMAIL" | "PHONE") {
  const spy = vi.spyOn(console, "info").mockImplementation(() => {});
  await sendVerificationCode(requestId, channel);
  const line = spy.mock.calls.map((c) => String(c[0])).reverse().find((l) => l.includes(`Code ${channel}`));
  spy.mockRestore();
  const code = line!.match(/(\d{6})$/)![1];
  await verifyCode(requestId, channel, code);
}

export async function makePublishedRequest(over: Partial<CreateRequestInput> = {}) {
  const input = requestInput(over);
  const { request, token } = await createDraft(input);
  if (input.contactPreference !== "PHONE") await verifyChannel(request.id, "EMAIL");
  if (input.contactPreference !== "EMAIL") await verifyChannel(request.id, "PHONE");
  const recipients = await prepareRecipients(request.id);
  await publishRequest(request.id, { contactConsent: true, marketingConsent: false });
  return { request: await prisma.request.findUniqueOrThrow({ where: { id: request.id } }), token, recipients, input };
}

export async function balance(companyId: string) {
  return (await prisma.creditWallet.findUnique({ where: { companyId } }))?.balance ?? 0;
}

/** Vide toutes les tables (le déclencheur append-only du registre est contourné par TRUNCATE). */
export async function resetDb() {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  for (let attempt = 0; ; attempt++) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
      break;
    } catch (e) {
      // une transaction d'un test concurrent précédent peut encore se terminer
      if (attempt >= 5) throw e;
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  for (const p of [
    { code: "PACK_5", name: "Pack 5 crédits", credits: 5, priceHtCents: 4500, sortOrder: 1 },
    { code: "PACK_15", name: "Pack 15 crédits", credits: 15, priceHtCents: 12000, sortOrder: 2 },
    { code: "PACK_40", name: "Pack 40 crédits", credits: 40, priceHtCents: 28000, sortOrder: 3 },
  ])
    await prisma.creditPack.create({ data: p });
}
