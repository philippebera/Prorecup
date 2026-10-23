import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Container, PageTitle, Empty } from "@/components/ui";
import { getSessionUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";
import { dateFr } from "@/lib/format";
import { ActionButton } from "@/components/client";

export const metadata: Metadata = { title: "Notifications", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?next=/notifications");
  const items = await prisma.notification.findMany({ where: { userId: user.id, channel: "IN_APP" }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <Container className="max-w-3xl py-8">
      <PageTitle title="Notifications" actions={<ActionButton url="/api/notifications/read" data={{ all: true }} label="Tout marquer comme lu" />} />
      {items.length === 0 ? <Empty>Aucune notification.</Empty> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className={`card ${n.readAt ? "opacity-70" : "border-brand-300"}`}>
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-ink-soft">{n.body}</p>
              <p className="mt-1 text-xs text-ink-mute">{dateFr(n.createdAt, true)} {n.link && <Link className="ml-2 font-semibold text-brand-700" href={n.link}>Voir</Link>}</p>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
