import Link from "next/link";
import { Container, PageTitle, Badge, Empty } from "@/components/ui";
import { clientRequestIds } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { REQUEST_STATUS, dateFr } from "@/lib/format";
import { ResendLinkForm } from "./forms";

export const dynamic = "force-dynamic";

export default async function SuiviPage() {
  const ids = await clientRequestIds();
  const requests = ids.length
    ? await prisma.request.findMany({ where: { id: { in: ids } }, orderBy: { createdAt: "desc" }, select: { id: true, publicRef: true, status: true, city: true, startDate: true, unlockCount: true, maxUnlocks: true } })
    : [];
  return (
    <Container className="max-w-3xl py-10">
      <PageTitle title="Suivre ma demande" />
      {requests.length ? (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id}>
              <Link href={`/suivi/${r.id}`} className="card flex items-center justify-between transition hover:-translate-y-0.5">
                <span>
                  <span className="font-semibold">{r.publicRef}</span> · {r.city} · pose le {dateFr(r.startDate)}
                  <span className="block text-sm text-ink-mute">{r.unlockCount} / {r.maxUnlocks} entreprise(s) ont obtenu vos coordonnées</span>
                </span>
                <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-6">
          <Empty>Aucune demande accessible depuis cet appareil. Le lien de suivi est temporaire : demandez-en un nouveau ci-dessous.</Empty>
          <div className="card"><ResendLinkForm /></div>
          <p className="text-sm text-ink-mute">Vous avez créé un compte ? <Link className="font-semibold text-brand-700" href="/connexion?next=/suivi">Connectez-vous</Link>.</p>
        </div>
      )}
    </Container>
  );
}
