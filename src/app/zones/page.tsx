import Link from "next/link";
import type { Metadata } from "next";
import { Container, PageTitle, Empty } from "@/components/ui";
import { coveredDepartments } from "@/lib/public-directory";

export const metadata: Metadata = { title: "Zones couvertes", description: "Départements où des loueurs de bennes inscrits et validés reçoivent des demandes.", alternates: { canonical: "/zones" } };
export const revalidate = 3600;

export default async function ZonesPage() {
  const deps = await coveredDepartments();
  return (
    <Container className="py-10">
      <PageTitle title="Zones couvertes" subtitle="Seuls les départements où au moins un loueur validé est inscrit sont listés." />
      {deps.length === 0 ? <Empty>Aucune zone couverte pour le moment : la plateforme est en cours de lancement.</Empty> : (
        <ul className="grid gap-2 sm:grid-cols-3">
          {deps.map((d) => (
            <li key={d.code}><Link className="card block hover:border-brand-300" href={`/zones/${d.slug}`}><span className="font-semibold">{d.name} ({d.code})</span><span className="block text-sm text-ink-mute">{d.companies} loueur(s) inscrit(s)</span></Link></li>
          ))}
        </ul>
      )}
    </Container>
  );
}
