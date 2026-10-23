import type { Metadata } from "next";
import Link from "next/link";
import { Container, PageTitle, Alert } from "@/components/ui";
import { LoginForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };
type Props = { searchParams: Promise<{ next?: string; erreur?: string; reinitialise?: string }> };

export default async function ConnexionPage({ searchParams }: Props) {
  const { next, erreur, reinitialise } = await searchParams;
  return (
    <Container className="max-w-md py-10">
      <PageTitle title="Connexion" subtitle="Loueurs, administrateurs et clients ayant créé un compte." />
      {erreur === "role" && <div className="mb-4"><Alert tone="warn">Ce compte n&apos;a pas accès à cet espace.</Alert></div>}
      {reinitialise && <div className="mb-4"><Alert tone="success">Mot de passe modifié. Connectez-vous.</Alert></div>}
      <LoginForm next={next} />
      <p className="mt-4 text-center text-sm text-ink-soft">
        Vous avez déposé une demande sans compte ? <Link className="font-semibold text-brand-700" href="/suivi/lien">Recevoir un lien de suivi</Link>
        <br />Loueur ? <Link className="font-semibold text-brand-700" href="/loueur/inscription">Inscrire mon entreprise</Link>
      </p>
    </Container>
  );
}
