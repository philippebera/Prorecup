import { fr } from '@/i18n/fr'
import { env } from '@/lib/env'

export function App() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-5xl font-light tracking-[-0.03em]">{fr.app.name}</h1>
      <p className="max-w-sm text-ink-2">{fr.app.tagline}</p>
      <p className="rounded-full bg-accent-pale px-4 py-2 text-sm font-bold text-accent-dark">
        {env ? fr.setup.building : fr.setup.missingEnv}
      </p>
    </main>
  )
}
