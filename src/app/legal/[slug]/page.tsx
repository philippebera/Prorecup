import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { LEGAL_DOCS, getLegalDoc } from "@/lib/legal";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return LEGAL_DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = getLegalDoc((await params).slug);
  return d ? { title: d.title, alternates: { canonical: `/legal/${d.slug}` } } : {};
}

export default async function LegalPage({ params }: Props) {
  const d = getLegalDoc((await params).slug);
  if (!d) notFound();
  return (
    <Container className="max-w-3xl py-10">
      <article className="prose-guide">
        <h1 className="text-3xl font-bold">{d.title}</h1>
        {d.sections.map((s) => (
          <section key={s.h}>
            <h2>{s.h}</h2>
            {s.p.map((t) => <p key={t}>{t}</p>)}
          </section>
        ))}
      </article>
    </Container>
  );
}
