import type { Metadata } from "next";
import { Container, PageTitle } from "@/components/ui";
import { ResetRequestForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default function OubliePage() {
  return (
    <Container className="max-w-md py-10">
      <PageTitle title="Mot de passe oublié" />
      <ResetRequestForm />
    </Container>
  );
}
