import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, PageTitle, Badge } from "@/components/ui";
import { publicCompany } from "@/lib/public-directory";
import { departmentName, departmentSlug } from "@/lib/geo";
import { serviceLabel, wasteLabel } from "@/lib/catalog";
import { APP_URL } from "@/lib/brand";
import { dateFr } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

const VERIF_LABEL: Record<string, string> = { SIRET: "SIRET", IDENTITY: "Identité de l'entreprise", PHONE: "Téléphone", EMAIL: "Email", ADDRESS: "Adresse", INSURANCE: "Assurance", WASTE_PERMITS: "Autorisations déchets" };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await publicCompany((await params).slug);
  if (!c) return {};
  return { title: `${c.tradeName || c.legalName} — location de bennes à ${c.city}`, description: c.description?.slice(0, 155) ?? `Loueur de bennes à ${c.city}.`, alternates: { canonical: `/loueurs/${c.slug}` } };
}

export default async function LoueurProfile({ params }: Props) {
  const c = await publicCompany((await params).slug);
  if (!c) notFound();
  const name = c.tradeName || c.legalName;
  const deps = [...new Set(c.zones.map((z) => z.departmentCode))];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name,
    url: `${APP_URL}/loueurs/${c.slug}`,
    telephone: c.phone,
    address: { "@type": "PostalAddress", addressLocality: c.city, postalCode: c.postalCode, addressCountry: "FR" },
    areaServed: deps.map((d) => departmentName(d)),
  };
  return (
    <Container className="max-w-3xl py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageTitle title={name} subtitle={`${c.city} · ${c.legalName}`} actions={<Link href="/demande" className="btn-primary">Recevoir des propositions</Link>} />
      {c.description && <p className="card mb-6 whitespace-pre-line text-ink-soft">{c.description}</p>}
      <div className="card mb-6 space-y-3 text-sm">
        <h2 className="text-base font-bold">Informations déclarées par l&apos;entreprise</h2>
        <p><strong>Bennes :</strong> {c.skipSizesM3.map((s) => `${s} m³`).join(", ")}</p>
        <p><strong>Déchets acceptés :</strong> {c.wasteTypes.map(wasteLabel).join(", ")}</p>
        {c.services.length > 0 && <p><strong>Services :</strong> {c.services.map(serviceLabel).join(", ")}</p>}
        {c.openingHours && <p><strong>Horaires :</strong> {c.openingHours}</p>}
        {c.availabilityNote && <p><strong>Disponibilité déclarée :</strong> {c.availabilityNote} <span className="text-ink-mute">(non garantie)</span></p>}
        <p><strong>Zones :</strong> {deps.map((d) => <Link key={d} className="mr-2 text-brand-700 underline" href={`/zones/${departmentSlug(d)}`}>{departmentName(d)}</Link>)}</p>
        <p><strong>Contact :</strong> {c.phone} · {c.email}{c.website ? ` · ${c.website}` : ""}</p>
      </div>
      <div className="card text-sm">
        <h2 className="text-base font-bold">Vérifié par la plateforme</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {c.verifications.length ? c.verifications.map((v) => <Badge key={v.field} tone="green">✔ {VERIF_LABEL[v.field] ?? v.field} ({dateFr(v.verifiedAt)})</Badge>) : <span className="text-ink-mute">Entreprise validée ; aucune vérification détaillée publiée.</span>}
        </div>
      </div>
    </Container>
  );
}
