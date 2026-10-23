import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { GUIDES, getGuide } from "@/lib/guides";
import { APP_URL } from "@/lib/brand";
import { dateFr } from "@/lib/format";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = getGuide((await params).slug);
  if (!g) return {};
  return { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` }, openGraph: { title: g.title, description: g.description, type: "article" } };
}

export default async function GuidePage({ params }: Props) {
  const g = getGuide((await params).slug);
  if (!g) notFound();
  const jsonLd = { "@context": "https://schema.org", "@type": "Article", headline: g.title, description: g.description, dateModified: g.updated, mainEntityOfPage: `${APP_URL}/guides/${g.slug}` };
  return (
    <Container className="max-w-3xl py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <nav className="mb-4 text-sm text-ink-mute"><Link href="/guides">Guides</Link> › {g.title}</nav>
      <article className="prose-guide">
        <h1 className="text-3xl font-bold">{g.title}</h1>
        <p className="mt-2 text-sm text-ink-mute">Mis à jour le {dateFr(g.updated)} · Informations générales et indicatives</p>
        {g.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p?.map((t) => <p key={t}>{t}</p>)}
            {s.list && <ul>{s.list.map((t) => <li key={t}>{t}</li>)}</ul>}
          </section>
        ))}
      </article>
      <div className="card mt-10 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-semibold">Prêt à décrire votre besoin ?</p>
        <Link href="/demande" className="btn-primary">Recevoir des propositions</Link>
      </div>
    </Container>
  );
}
