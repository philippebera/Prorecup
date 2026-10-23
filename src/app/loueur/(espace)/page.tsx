import Link from "next/link";
import { Stat, Empty, Badge } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { getBalance } from "@/lib/credits";
import { listPreviewsForCompany } from "@/lib/requests/views";
import { prisma } from "@/lib/db";
import { PreviewCard } from "@/components/preview-card";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: process.env.APP_TIMEZONE || "Europe/Paris" }).format(new Date()));
  return h < 18 ? "Bonjour" : "Bonsoir";
}

export default async function LoueurHome() {
  const { company, user } = await requirePageProvider();
  const [balance, previews, unlocks, offers, verifs] = await Promise.all([
    getBalance(company.id),
    listPreviewsForCompany(company.id, { onlyOpen: true }),
    prisma.unlock.count({ where: { companyId: company.id } }),
    prisma.offer.count({ where: { companyId: company.id } }),
    prisma.companyVerification.findMany({ where: { companyId: company.id } }),
  ]);
  const open = previews.filter((p) => p.available && !p.unlockedByMe);
  const firstName = user.name.split(" ")[0];
  return (
    <>
      <h1 className="text-4xl font-extrabold leading-[1.05] sm:text-5xl">
        {greeting()},<br />
        <span className="text-brand-500">{firstName}</span>
      </h1>
      <p className="mt-2 text-ink-soft">{open.length ? `${open.length} demande(s) ouverte(s) dans votre zone.` : "Aucune nouvelle demande ouverte pour l'instant."}</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-[1.3fr_1fr_1fr]">
        <div className="card-dark col-span-2 flex flex-col justify-between sm:col-span-1">
          <div className="flex items-start justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Solde de l&apos;entreprise</p>
            <Link href="/loueur/portefeuille" className="rounded-full bg-lime px-3 py-1 text-xs font-bold text-ink">Recharger →</Link>
          </div>
          <p className="mt-3 text-5xl font-extrabold tracking-tight text-lime">
            {balance}
            <span className="ml-1.5 text-base font-semibold text-white/60">crédit{balance > 1 ? "s" : ""}</span>
          </p>
          <p className="mt-2 text-xs text-white/50">1 crédit = 1 contact · partagé entre vos utilisateurs</p>
        </div>
        <Stat label="Contacts débloqués" value={unlocks} />
        <Stat label="Offres envoyées" value={offers} />
      </div>

      <div className="mb-3 mt-10 flex items-end justify-between">
        <h2 className="text-2xl font-extrabold">Demandes ouvertes</h2>
        <Link href="/loueur/demandes" className="text-sm font-bold underline decoration-lime decoration-4 underline-offset-4">Tout voir</Link>
      </div>
      {open.length === 0 ? (
        <Empty>Rien de nouveau. Vérifiez vos zones et types de déchets dans « Entreprise ».</Empty>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {open.slice(0, 6).map((p) => (
            <PreviewCard key={p.id} p={p} />
          ))}
        </div>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-3 rounded-3xl bg-white px-5 py-4 shadow-soft ring-1 ring-black/[0.04]">
        <span className="flex items-center gap-2 text-sm font-bold"><span className="h-2 w-2 rounded-full bg-brand-500" />Vérifié par l&apos;administration</span>
        {verifs.length ? verifs.map((v) => <Badge key={v.id} tone="green">✓ {v.field}</Badge>) : <span className="text-sm text-ink-mute">Rien pour l&apos;instant · le reste de votre profil est déclaratif</span>}
      </div>
    </>
  );
}
