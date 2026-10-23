import { PageTitle, Alert, Badge } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { InviteForm, DeleteAccountButton } from "./client";

export default async function EquipePage() {
  const { company, memberRole, user } = await requirePageProvider("/loueur/equipe");
  const [members, invitations] = await Promise.all([
    prisma.companyMember.findMany({ where: { companyId: company.id }, include: { user: true }, orderBy: { createdAt: "asc" } }),
    prisma.companyInvitation.findMany({ where: { companyId: company.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } } }),
  ]);
  return (
    <>
      <PageTitle title="Utilisateurs de l'entreprise" subtitle="Le portefeuille de crédits est partagé : un contact débloqué par un utilisateur est accessible à tous, sans nouveau débit." />
      <div className="card mb-6">
        <ul className="divide-y divide-black/5">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-2">
              <span>{m.user.name} <span className="text-sm text-ink-mute">· {m.user.email}</span></span>
              <Badge tone={m.role === "OWNER" ? "green" : "gray"}>{m.role === "OWNER" ? "Responsable" : "Utilisateur"}</Badge>
            </li>
          ))}
        </ul>
        {invitations.length > 0 && <p className="mt-3 text-sm text-ink-mute">Invitations en attente : {invitations.map((i) => `${i.email} (jusqu'au ${dateFr(i.expiresAt)})`).join(", ")}</p>}
      </div>
      {memberRole === "OWNER" ? <InviteForm /> : <Alert tone="info">Seul le responsable peut inviter des utilisateurs.</Alert>}
      <div className="card mt-6">
        <h2 className="font-bold">Mon compte</h2>
        <p className="mt-1 text-sm text-ink-soft">Connecté en tant que {user.email}. La suppression anonymise votre compte ; l&apos;historique comptable de l&apos;entreprise est conservé.</p>
        <div className="mt-3"><DeleteAccountButton /></div>
      </div>
    </>
  );
}
