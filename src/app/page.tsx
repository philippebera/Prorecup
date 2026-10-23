import Link from "next/link";
import { Container } from "@/components/ui";
import { PhoneMock } from "@/components/phone-mock";
import { BRAND_NAME, APP_URL } from "@/lib/brand";
import { WASTE_TYPES } from "@/lib/catalog";
import { GUIDES } from "@/lib/guides";

export const revalidate = 3600;

const STEPS: [string, string, string][] = [
  ["01", "Décrivez votre besoin", "Adresse, dates, déchets, volume. Vous vérifiez votre téléphone ou votre email."],
  ["02", "Validez les destinataires", "Vous voyez les loueurs de votre zone avant la diffusion. Trois au maximum pourront obtenir vos coordonnées."],
  ["03", "Comparez et choisissez", "Les loueurs vous appellent, vous écrivent ou envoient une offre détaillée dans votre espace."],
];

const PROMISES: [string, string][] = [
  ["Gratuit pour vous", "Aucun frais n'est demandé au demandeur."],
  ["3 entreprises maximum", "Vous savez lesquelles ont reçu vos coordonnées."],
  ["Adresse protégée", "Seule la commune est visible avant déblocage."],
  ["Vous gardez la main", "Arrêtez les contacts ou fermez la demande à tout moment."],
];

export default function Home() {
  const jsonLd = { "@context": "https://schema.org", "@type": "WebSite", name: BRAND_NAME, url: APP_URL, description: "Mise en relation entre demandeurs et loueurs de bennes à déchets en France." };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Héros */}
      <Container className="pt-2">
        <section className="relative overflow-hidden rounded-4xl bg-ink px-6 pb-0 pt-10 text-white sm:px-12 sm:pt-14 lg:pb-14">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-lime/20 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-brand-500/40 blur-3xl" />
          <div className="relative grid items-center gap-10 lg:grid-cols-[1.15fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90">
                <span className="h-2 w-2 rounded-full bg-lime" /> Gratuit pour les demandeurs
              </p>
              <h1 className="mt-5 text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
                <span className="text-lime">Votre benne,</span>
                <br />
                sans chercher.
              </h1>
              <p className="mt-5 max-w-lg text-lg text-white/70">
                Décrivez votre chantier en 3 minutes. Votre demande est transmise aux loueurs de votre zone ; chacun fixe son prix et vous réglez la location directement avec lui.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/demande" className="btn-primary justify-between whitespace-nowrap py-3 pl-6 pr-3 text-base sm:justify-center sm:py-4 sm:text-lg">
                  Recevoir des propositions
                  <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm text-lime">→</span>
                </Link>
                <Link href="/guides/choisir-volume-benne" className="btn bg-white/10 px-6 py-4 text-white hover:bg-white/15">Quel volume choisir ?</Link>
              </div>
              <p className="mt-4 text-sm text-white/50">Aucun mot de passe à créer · Sans engagement</p>
            </div>

            <div className="relative h-[430px] sm:h-[470px] lg:h-[500px]">
              <PhoneMock className="absolute left-1/2 top-2 -translate-x-1/2 rotate-[-7deg] lg:top-0">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-mute">Exemple d&apos;écran</p>
                <p className="mt-1 text-2xl font-extrabold leading-none">Ma demande</p>
                <div className="mt-3 rounded-3xl bg-ink p-3.5 text-white">
                  <p className="text-[10px] text-white/50">Commune</p>
                  <p className="text-sm font-bold">Votre ville</p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-white/40" />
                    <span className="h-px flex-1 border-t border-dashed border-white/30" />
                    <span className="h-3 w-3 rounded-full bg-lime ring-4 ring-lime/20" />
                  </div>
                  <p className="mt-2 text-[10px] text-white/50">Adresse exacte masquée avant déblocage</p>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-full bg-lime py-2 pl-4 pr-2">
                  <span className="text-xs font-bold text-ink">Recevoir des propositions</span>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-lime">→</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white p-3"><p className="text-xl font-extrabold">3</p><p className="text-[10px] text-ink-mute">entreprises max.</p></div>
                  <div className="rounded-2xl bg-ink p-3 text-white"><p className="text-xl font-extrabold text-lime">0 €</p><p className="text-[10px] text-white/50">pour vous</p></div>
                </div>
              </PhoneMock>
              <div className="absolute right-0 top-10 hidden w-48 rounded-3xl bg-white p-3.5 text-ink shadow-float sm:block lg:-right-2">
                <p className="text-[10px] font-semibold text-ink-mute">Coordonnées</p>
                <p className="text-sm font-bold">Vérifiées ✓</p>
                <div className="mt-2 h-1.5 rounded-full bg-canvas"><div className="h-full w-2/3 rounded-full bg-lime" /></div>
              </div>
              <div className="absolute bottom-24 left-0 hidden items-center gap-3 rounded-2xl bg-white/10 px-3.5 py-2.5 backdrop-blur sm:flex">
                <span className="h-2 w-2 rounded-full bg-lime" />
                <span className="text-xs font-semibold">Vous choisissez librement</span>
              </div>
            </div>
          </div>
        </section>
      </Container>

      {/* Engagements */}
      <Container className="mt-6">
        <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {PROMISES.map(([t, d], i) => (
            <li key={t} className={i === 0 ? "rounded-3xl bg-lime p-5" : "card"}>
              <p className="font-extrabold">{t}</p>
              <p className={`mt-1 text-sm ${i === 0 ? "text-ink/70" : "text-ink-mute"}`}>{d}</p>
            </li>
          ))}
        </ul>
      </Container>

      <Container className="py-16">
        <div className="flex items-end justify-between gap-4">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Comment ça marche</h2>
          <Link href="/demande" className="hidden text-sm font-bold underline decoration-lime decoration-4 underline-offset-4 sm:inline">Commencer</Link>
        </div>
        <ol className="mt-6 grid gap-3 sm:grid-cols-3">
          {STEPS.map(([n, t, d]) => (
            <li key={n} className="card">
              <span className="text-sm font-extrabold text-brand-500">{n}</span>
              <h3 className="mt-6 text-xl font-bold">{t}</h3>
              <p className="mt-1.5 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div className="card-dark flex flex-col justify-between">
            <div>
              <h2 className="text-2xl font-extrabold">Ce que nous ne promettons pas</h2>
              <p className="mt-3 text-white/70">Nous ne garantissons ni réponse, ni délai, ni disponibilité, ni prix : cela dépend des loueurs inscrits dans votre zone. Nous ne prélevons aucune commission sur votre location.</p>
            </div>
            <Link href="/zones" className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold hover:bg-white/15">Voir les zones couvertes →</Link>
          </div>
          <div className="card">
            <h2 className="text-2xl font-extrabold">Déchets acceptés en benne</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {WASTE_TYPES.map((w) => (
                <li key={w.code} className="inline-flex items-center gap-2 rounded-full bg-canvas py-1.5 pl-1.5 pr-3.5 text-sm font-medium">
                  <span aria-hidden className="grid h-7 w-7 place-items-center rounded-full bg-white">{w.icon}</span>{w.label}
                </li>
              ))}
            </ul>
            <Link href="/guides/dechets-acceptes-benne" className="mt-5 inline-block text-sm font-bold underline decoration-lime decoration-4 underline-offset-4">Exemples et exclusions</Link>
          </div>
        </div>

        <div className="mt-16">
          <h2 className="text-3xl font-extrabold sm:text-4xl">Guides pratiques</h2>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="card group flex h-full items-start justify-between gap-4 transition hover:-translate-y-0.5">
                  <span>
                    <span className="block font-bold">{g.title}</span>
                    <span className="mt-1 block text-sm text-ink-soft">{g.description}</span>
                  </span>
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-canvas transition group-hover:bg-lime">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-16 overflow-hidden rounded-4xl bg-lime p-8 sm:p-12">
          <div aria-hidden className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-ink/5" />
          <p className="text-sm font-bold uppercase tracking-wider text-ink/60">Espace loueurs</p>
          <h2 className="mt-2 max-w-xl text-3xl font-extrabold sm:text-4xl">Recevez les demandes de votre zone. Payez seulement les contacts qui vous intéressent.</h2>
          <p className="mt-3 max-w-xl text-ink/70">Inscription gratuite, consultation gratuite des demandes, prix libres, aucune commission sur vos locations.</p>
          <Link href="/loueur/inscription" className="btn-dark mt-6">Inscrire mon entreprise →</Link>
        </div>
      </Container>
    </>
  );
}
