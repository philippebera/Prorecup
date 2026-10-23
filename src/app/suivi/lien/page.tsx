import { Container, PageTitle, Alert } from "@/components/ui";
import { ResendLinkForm } from "../forms";

type Props = { searchParams: Promise<{ erreur?: string }> };

export default async function LienPage({ searchParams }: Props) {
  const { erreur } = await searchParams;
  return (
    <Container className="max-w-xl py-10">
      <PageTitle title="Recevoir un nouveau lien de suivi" />
      {erreur === "expire" && <div className="mb-4"><Alert tone="warn">Ce lien de suivi a expiré ou a été révoqué.</Alert></div>}
      {erreur === "limite" && <div className="mb-4"><Alert tone="warn">Trop de tentatives. Réessayez plus tard.</Alert></div>}
      <div className="card"><ResendLinkForm /></div>
    </Container>
  );
}
