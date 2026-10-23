import { prisma } from "./db";
import { departmentName, departmentSlug } from "./geo";

// Annuaire public : uniquement des entreprises validées, non démo, avec profil public.
const PUBLIC_WHERE = { status: "APPROVED" as const, isDemo: false, publicProfile: true };

/** Départements réellement couverts (au moins un loueur validé) — pas de pages vides. */
export async function coveredDepartments() {
  const zones = await prisma.serviceZone.groupBy({ by: ["departmentCode"], where: { company: PUBLIC_WHERE }, _count: { companyId: true } });
  return zones
    .map((z) => ({ code: z.departmentCode, name: departmentName(z.departmentCode), slug: departmentSlug(z.departmentCode), companies: z._count.companyId }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export async function companiesInDepartment(code: string) {
  return prisma.company.findMany({
    where: { ...PUBLIC_WHERE, zones: { some: { departmentCode: code } } },
    select: { slug: true, legalName: true, tradeName: true, city: true, skipSizesM3: true, wasteTypes: true, services: true },
    orderBy: { legalName: "asc" },
  });
}

export async function publicCompany(slug: string) {
  return prisma.company.findFirst({
    where: { ...PUBLIC_WHERE, slug },
    include: { zones: true, verifications: { select: { field: true, verifiedAt: true } }, establishments: { select: { city: true, postalCode: true } } },
  });
}

export async function publicCompanySlugs() {
  return prisma.company.findMany({ where: PUBLIC_WHERE, select: { slug: true, updatedAt: true } });
}
