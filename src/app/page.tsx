import Link from "next/link";
import { Container } from "@/components/ui";
import { BRAND_NAME, APP_URL } from "@/lib/brand";
import { WASTE_TYPES } from "@/lib/catalog";
import { GUIDES } from "@/lib/guides";

export const revalidate = 3600;

export default function Home() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND_NAME,
    url: APP_URL,
    description: "Mise en relation entre demandeurs et loueurs de bennes à déchets en France.",
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <section className="bg-gradient-to-b from-brand-50 to-slate-50">
        <Container className="py-12 sm:py-20">
          <div className="max-w-2xl">
            <p className="mb-3 inline-block rounded-full bg-white px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">Gratuit pour les demandeurs · Sans engagement</p>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">Besoin d&apos;une benne à déchets ? Décrivez votre chantier, des loueurs vous contactent.</h1>
            <p className="mt-4 text-lg text-ink-soft">
              Particuliers et professionnels : indiquez vos dates, vos déchets et le volume. Votre demande est transmise aux loueurs inscrits qui desservent votre zone. Chaque loueur fixe son prix, et vous réglez la location directement avec lui.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/demande" className="btn-primary px-6 py-3.5 text-lg">Recevoir des propositions</Link>
              <Link href="/guides/choisir-volume-benne" className="btn-secondary px-6 py-3.5">Quel volume choisir ?</Link>
            </div>
            <p className="mt-3 text-sm text-ink-mute">Environ 3 minutes. Aucun mot de passe à créer.</p>
          </div>
        </Container>
      </section>

      <Container className="py-12">
        <h2 className="text-2xl font-bold">Comment ça marche</h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-3">
          {[
            ["1", "Décrivez votre besoin", "Adresse du chantier, dates, type de déchets, volume. Vous vérifiez votre téléphone ou votre email."],
            ["2", "Votre demande est transmise", "Vous voyez la liste des loueurs destinataires avant la diffusion. Trois entreprises au maximum pourront obtenir vos coordonnées."],
            ["3", "Comparez et choisissez", "Les loueurs vous contactent ou vous envoient une offre détaillée. Vous suivez tout depuis votre espace."],
          ].map(([n, t, d]) => (
            <li key={n} className="card">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 font-bold text-white">{n}</span>
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1 text-sm text-ink-soft">{d}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <div className="card">
            <h2 className="text-lg font-bold">Ce qu&apos;il faut savoir</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>✔ Le service est gratuit pour vous : aucun frais n&apos;est demandé au demandeur.</li>
              <li>✔ Vos coordonnées ne sont visibles que par 3 entreprises au maximum, que vous pouvez consulter.</li>
              <li>✔ Votre adresse exacte n&apos;est jamais affichée avant qu&apos;une entreprise ait débloqué votre demande.</li>
              <li>✔ Vous pouvez arrêter les nouveaux contacts ou fermer votre demande à tout moment.</li>
              <li>ℹ Nous ne garantissons ni une réponse, ni un délai, ni une disponibilité : cela dépend des loueurs de votre zone.</li>
            </ul>
          </div>
          <div className="card">
            <h2 className="text-lg font-bold">Déchets acceptés en benne</h2>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {WASTE_TYPES.map((w) => (
                <li key={w.code} className="flex items-center gap-2"><span aria-hidden>{w.icon}</span>{w.label}</li>
              ))}
            </ul>
            <Link href="/guides/dechets-acceptes-benne" className="mt-3 inline-block text-sm font-semibold text-brand-700">Voir les exemples et exclusions →</Link>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold">Guides pratiques</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className="card block hover:border-brand-300">
                  <p className="font-semibold">{g.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">{g.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-12 rounded-2xl bg-brand-800 p-8 text-white">
          <h2 className="text-xl font-bold">Vous êtes loueur de bennes ?</h2>
          <p className="mt-2 text-brand-100">Inscription gratuite. Recevez les demandes de votre zone, consultez-les gratuitement, et utilisez des crédits uniquement pour obtenir les coordonnées des demandes qui vous intéressent. Aucune commission sur vos locations.</p>
          <Link href="/loueur/inscription" className="btn mt-4 bg-white text-brand-800 hover:bg-brand-50">Inscrire mon entreprise</Link>
        </div>
      </Container>
    </>
  );
}
