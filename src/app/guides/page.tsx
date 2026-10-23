import Link from "next/link";
import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { GUIDES } from "@/lib/guides";

export const metadata: Metadata = { title: "Guides pratiques sur la location de bennes", description: "Volumes, déchets acceptés, poids et autorisations de voirie : nos guides pour préparer votre location de benne.", alternates: { canonical: "/guides" } };

export default function GuidesPage() {
  return (
    <Container className="py-10">
      <PageTitle title="Guides pratiques" subtitle="Des repères pour préparer votre location de benne." />
      <ul className="grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="card block h-full hover:border-brand-300">
              <h2 className="font-semibold">{g.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{g.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  );
}
