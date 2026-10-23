import type { Metadata } from "next";
import { Container, PageTitle, Alert } from "@/components/ui";
import { InvitationForm } from "@/components/auth-forms";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";

export const metadata: Metadata = { title: "Invitation", robots: { index: false }, referrer: "no-referrer" };
export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ t?: string }> };

export default async function InvitationPage({ searchParams }: Props) {
  const { t } = await searchParams;
  const inv = t ? await prisma.companyInvitation.findUnique({ where: { tokenHash: sha256(t) }, include: { company: { select: { legalName: true } } } }) : null;
  const valid = inv && !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > new Date();
  return (
    <Container className="max-w-md py-10">
      <PageTitle title="Rejoindre une entreprise" subtitle={valid ? `${inv.company.legalName} · ${inv.email}` : undefined} />
      {valid ? <InvitationForm token={t!} /> : <Alert tone="error">Invitation invalide ou expirée.</Alert>}
    </Container>
  );
}
