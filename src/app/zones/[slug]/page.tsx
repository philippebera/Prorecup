import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { companiesInDepartment } from "@/lib/public-directory";
import { departmentFromSlug, departmentName } from "@/lib/geo";
import { wasteLabel } from "@/lib/catalog";

type Props = { params: Promise<{ slug: string }> };
export const revalidate = 3600;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const code = departmentFromSlug((await params).slug);
  if (!code) return {};
  const companies = await companiesInDepartment(code);
  if (!companies.length) return { robots: { index: false } };
  const name = departmentName(code);
  return {
    title: `Location de benne — ${name} (${code})`,
    description: `${companies.length} loueur(s) de bennes validé(s) desservent le département ${name}. Décrivez votre besoin gratuitement.`,
    alternates: { canonical: `/zones/${(await params).slug}` },
  };
}

export default async function ZonePage({ params }: Props) {
  const code = departmentFromSlug((await params).slug);
  if (!code) notFound();
  const companies = await companiesInDepartment(code);
  if (!companies.length) notFound(); // pas de page vide indexable
  const name = departmentName(code);
  return (
    <Container className="py-10">
      <nav className="mb-3 text-sm text-ink-mute"><Link href="/zones">Zones</Link> › {name}</nav>
      <PageTitle title={`Location de benne : ${name} (${code})`} subtitle={`${companies.length} loueur(s) inscrit(s) et validé(s) déclarent desservir ce département.`} actions={<Link href="/demande" className="btn-primary">Recevoir des propositions</Link>} />
      <ul className="grid gap-3 sm:grid-cols-2">
        {companies.map((c) => (
          <li key={c.slug}>
            <Link href={`/loueurs/${c.slug}`} className="card block h-full hover:border-brand-300">
              <p className="font-semibold">{c.tradeName || c.legalName}</p>
              <p className="text-sm text-ink-mute">{c.city}</p>
              <p className="mt-2 text-sm">Bennes : {c.skipSizesM3.map((s) => `${s} m³`).join(", ")}</p>
              <p className="text-sm text-ink-soft">{c.wasteTypes.map(wasteLabel).join(", ")}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-ink-mute">Informations déclarées par les entreprises. Les disponibilités et prix ne sont pas garantis.</p>
    </Container>
  );
}
