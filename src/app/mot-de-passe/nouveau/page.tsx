import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { ResetForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false }, referrer: "no-referrer" };
type Props = { searchParams: Promise<{ t?: string }> };

export default async function NouveauPage({ searchParams }: Props) {
  const { t } = await searchParams;
  return (
    <Container className="max-w-md py-10">
      <PageTitle title="Choisir un nouveau mot de passe" />
      <ResetForm token={t ?? ""} />
    </Container>
  );
}
