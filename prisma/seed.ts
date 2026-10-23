/* Données initiales (packs) + données de démonstration isolées (DEMO_SEED=true).
 * Les données de démonstration sont marquées isDemo=true, utilisent des domaines
 * .invalid et ne sont jamais mélangées aux vraies demandes (voir findMatchingCompanies). */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/crypto";

const prisma = new PrismaClient();

const PACKS = [
  { code: "PACK_5", name: "Pack 5 crédits", credits: 5, priceHtCents: 4500, sortOrder: 1 },
  { code: "PACK_15", name: "Pack 15 crédits", credits: 15, priceHtCents: 12000, sortOrder: 2 },
  { code: "PACK_40", name: "Pack 40 crédits", credits: 40, priceHtCents: 28000, sortOrder: 3 },
];

async function main() {
  for (const p of PACKS) {
    await prisma.creditPack.upsert({ where: { code: p.code }, create: p, update: {} });
  }
  console.log("Packs de crédits : OK");

  if (process.env.DEMO_SEED !== "true") return;
  if (process.env.NODE_ENV === "production") throw new Error("Refus : pas de données de démonstration en production");

  const pw = await hashPassword("demo-password-123");
  await prisma.user.upsert({
    where: { email: "admin@demo.invalid" },
    create: { email: "admin@demo.invalid", name: "Admin démo", role: "ADMIN", passwordHash: pw, isDemo: true, emailVerifiedAt: new Date() },
    update: {},
  });

  const companies = [
    { slug: "demo-bennes-alpha", legalName: "DÉMO Bennes Alpha", siret: "99999999900001", city: "Lyon", postalCode: "69003", deps: ["69", "01"], sizes: [3, 8, 10, 15], waste: ["GRAVATS", "DIB", "VERTS", "BOIS", "ENCOMBRANTS"], services: ["PUBLIC_ROAD", "WEEKEND"] },
    { slug: "demo-recyclage-beta", legalName: "DÉMO Recyclage Bêta", siret: "99999999800002", city: "Villeurbanne", postalCode: "69100", deps: ["69"], sizes: [6, 10, 20, 30], waste: ["GRAVATS", "DIB", "BOIS", "METAUX", "CARTONS"], services: ["URGENT", "PUBLIC_ROAD"] },
    { slug: "demo-location-gamma", legalName: "DÉMO Location Gamma", siret: "99999999700003", city: "Vénissieux", postalCode: "69200", deps: ["69", "38"], sizes: [3, 6, 8], waste: ["GRAVATS", "DIB", "VERTS", "ENCOMBRANTS", "PLATRE"], services: ["BIG_BAG"] },
    { slug: "demo-transports-delta", legalName: "DÉMO Transports Delta", siret: "99999999600004", city: "Bron", postalCode: "69500", deps: ["69"], sizes: [10, 15, 20], waste: ["GRAVATS", "DIB", "VERTS", "BOIS", "ENCOMBRANTS"], services: ["PUBLIC_ROAD", "URGENT", "TIPPER"] },
  ];
  for (const [i, c] of companies.entries()) {
    const company = await prisma.company.upsert({
      where: { siret: c.siret },
      update: {},
      create: {
        slug: c.slug, legalName: c.legalName, siret: c.siret, siren: c.siret.slice(0, 9), email: `contact@${c.slug}.demo.invalid`,
        phone: `060000000${i}`, addressLine: "Adresse de démonstration", postalCode: c.postalCode, city: c.city,
        description: "Entreprise fictive de démonstration. Aucune information réelle.", status: "APPROVED", approvedAt: new Date(),
        skipSizesM3: c.sizes, wasteTypes: c.waste, services: c.services, isDemo: true, publicProfile: false,
        availabilityNote: "Disponibilité déclarée (démonstration)",
        zones: { create: c.deps.map((d) => ({ departmentCode: d })) },
        wallet: { create: { balance: 0 } },
        establishments: { create: { name: "Dépôt démo", addressLine: "Adresse de démonstration", postalCode: c.postalCode, city: c.city } },
      },
    });
    await prisma.user.upsert({
      where: { email: `loueur${i + 1}@demo.invalid` },
      update: {},
      create: { email: `loueur${i + 1}@demo.invalid`, name: `Loueur démo ${i + 1}`, role: "PROVIDER", passwordHash: pw, isDemo: true, emailVerifiedAt: new Date(), membership: { create: { companyId: company.id, role: "OWNER" } } },
    });
    const ref = `demo-welcome:${company.id}`;
    if (!(await prisma.creditLedgerEntry.findUnique({ where: { reference: ref } }))) {
      await prisma.$transaction([
        prisma.creditLedgerEntry.create({ data: { companyId: company.id, type: "ADMIN_ADJUSTMENT", amount: 10, balanceAfter: 10, reference: ref, reason: "Crédits de démonstration" } }),
        prisma.creditWallet.update({ where: { companyId: company.id }, data: { balance: 10 } }),
      ]);
    }
  }

  await prisma.permitAuthority.upsert({
    where: { id: "demo-authority-lyon" },
    update: {},
    create: {
      id: "demo-authority-lyon", name: "DÉMO — Autorité fictive (à remplacer par la référence officielle)", kind: "AUTRE", departmentCode: "69",
      postalCodes: [], instructions: "Entrée de démonstration : vérifiez la démarche réelle auprès de la mairie concernée.", active: true,
    },
  });

  console.log("Données de démonstration : OK (comptes *@demo.invalid, mot de passe demo-password-123)");
}

main().finally(() => prisma.$disconnect());
