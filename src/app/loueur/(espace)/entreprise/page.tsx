import { PageTitle, Alert } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { CompanyForm, emptyCompany } from "@/components/company-form";

export default async function EntreprisePage() {
  const { company, memberRole } = await requirePageProvider("/loueur/entreprise");
  const c = await prisma.company.findUniqueOrThrow({ where: { id: company.id }, include: { zones: true, establishments: true, verifications: true } });
  const initial = {
    ...emptyCompany,
    legalName: c.legalName, tradeName: c.tradeName ?? "", siret: c.siret, vatNumber: c.vatNumber ?? "", email: c.email, phone: c.phone,
    website: c.website ?? "", addressLine: c.addressLine, postalCode: c.postalCode, city: c.city, description: c.description ?? "",
    skipSizesM3: c.skipSizesM3, wasteTypes: c.wasteTypes, services: c.services,
    departments: c.zones.filter((z) => !z.postalCode).map((z) => z.departmentCode),
    postalCodes: c.zones.filter((z) => z.postalCode).map((z) => z.postalCode).join(", "),
    openingHours: c.openingHours ?? "", availabilityNote: c.availabilityNote ?? "", publicProfile: c.publicProfile,
    billingName: c.billingName ?? "", billingEmail: c.billingEmail ?? "", billingAddress: c.billingAddress ?? "", billingPostalCode: c.billingPostalCode ?? "", billingCity: c.billingCity ?? "",
  };
  return (
    <>
      <PageTitle title="Mon entreprise" subtitle="Les informations sont déclaratives, sauf celles marquées comme vérifiées par l'administration." />
      <div className="mb-4">
        <Alert tone="info" title="Vérifié par l'administration">
          {c.verifications.length ? c.verifications.map((v) => `${v.field} (${v.method}, ${v.verifiedAt.toLocaleDateString("fr-FR")})`).join(" · ") : "Aucune information vérifiée pour le moment."}
        </Alert>
      </div>
      <div className="card mb-6 text-sm">
        <p className="font-semibold">Établissements</p>
        <ul className="mt-1">{c.establishments.map((e) => <li key={e.id}>• {e.name} — {e.addressLine}, {e.postalCode} {e.city}</li>)}</ul>
      </div>
      {memberRole === "OWNER" ? <CompanyForm mode="edit" initial={initial} /> : <Alert tone="info">Seul le responsable de l&apos;entreprise peut modifier ces informations.</Alert>}
    </>
  );
}
