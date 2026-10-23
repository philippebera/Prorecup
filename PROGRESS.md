# PROGRESS — Cercle web

## Jalon 0 — Lecture et plan + outillage

### Fait

- Branche `claude/cercle-web` (le dépôt `Prorecup` contient par ailleurs un autre projet sur `claude/benne-direct`, non touché).
- Vite 8 + React 18.3 + TypeScript 6 strict (`noUncheckedIndexedAccess`), alias `@/`.
- Tailwind 4 avec tokens de design en variables CSS (clair / sombre auto / `.theme-dark` pour le feed), Manrope.
- ESLint 10 (+ règle qui interdit React/DOM/Supabase dans `src/domain` et React/DOM dans `src/data`), Prettier.
- Vitest (tests unitaires `src/**/*.test.ts`), Playwright (projets iPhone + ordinateur, backend simulé).
- PWA : `vite-plugin-pwa` en `injectManifest`, service worker maison `src/sw.ts` (précache + `push` + `notificationclick`) → `dist/sw.js`.
- `netlify.toml` (build, SPA `/* → /index.html` 200, `sw.js` sans cache, `nosniff`, `Referrer-Policy`, `X-Robots-Tag: noindex` sur `/admin`), `robots.txt`, `manifest.webmanifest`.
- CI GitHub Actions : typecheck, lint, format, tests, build, puis e2e.
- `CLAUDE.md` = spécification du projet.

### Vérifié dans le conteneur

- `npm run check` (typecheck + lint + format + tests) : vert.
- `npm run build` : OK (`dist/sw.js` généré).
- `npm run e2e` : test de fumée vert sur iPhone 13 (émulé) et Chrome ordinateur.

### Backend Supabase (lecture seule, aucune écriture)

- Tables `docs` (14 lignes : 3 works, 3 posts, 3 reviews, 1 like, 1 member, 1 profile, 2 sessions), `admins` (1), `app_config` (4).
- Triggers `docs_guard_trg` (BEFORE) et `docs_notify_trg` (AFTER, `pg_net` → `/functions/v1/notify`, en-tête `x-cercle-secret`) conformes au §3.3.
- RLS conforme au §3.3 ; `doc_write_ok` accepte déjà `reports` et `blocks` (privés, `uid` = auteur).
- RPC présentes : `is_admin`, `is_approved`, `delete_my_account`, `claim_admin`.
- Edge Functions déployées : **aucune** (`notify` à proposer au jalon 7).
- Conseils sécurité Supabase : `pg_net` dans le schéma `public` (WARN) ; protection des mots de passe fuités désactivée (à activer dans Auth → réglages, sans code) ; `claim_admin()` reste appelable (sans effet tant que `admins` n'est pas vide — à retirer plus tard par migration).

### Bloqué / non fait

- **Fichiers `reference/` absents** du conteneur (le zip n'a pas été joint) et le site `cercle-films-livres.netlify.app` est bloqué par la politique réseau de l'environnement cloud. Résumé en 15 lignes de la référence, icônes PWA et SW de référence : **en attente**.
- Projet Netlify pas encore relié au dépôt (action à faire par le propriétaire, voir ci-dessous).

### À faire par le propriétaire

1. Ajouter `reference/` au dépôt (commit sur cette branche) **ou** autoriser `cercle-films-livres.netlify.app` dans l'accès réseau de l'environnement.
2. Netlify : créer un **nouveau** site relié à `philippebera/Prorecup`, branche `claude/cercle-web` (ne pas toucher `cercle-films-livres`), variables `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`, aperçus de branche activés.

## Arborescence proposée

```
src/
  domain/        ratings.ts, affinity.ts, scoring.ts (pop, trend, forYou), hashtags.ts,
                 views.ts (vue qualifiée), streaks.ts, recos.ts, works.ts (titre normalisé), *.test.ts
  data/          types.ts (collections §3.2), docs.ts (adaptateur listDocs/getDoc/setDoc/updateDoc/deleteDoc/subscribe,
                 client injecté), ids.ts (clés composées), hooks/ (TanStack Query + temps réel)
  features/      auth, onboarding, feed, search, work, publish, studio, profile, lists, comments, recos, admin (lazy)
  components/    Sheet, Pill, Card, RatingBadge, Cover, TabBar, Avatar…
  lib/           env, supabase, media (MediaProvider, compression, TUS), push, pwa, session-tracking
  i18n/fr.ts
  sw.ts
supabase/migrations/   (aucune pour l'instant)
e2e/                    parcours critiques, backend simulé
```

## Prochain jalon (1)

Formules du §4 en TypeScript pur + tests, adaptateur `docs` et types — **nécessite la référence** pour reproduire les fonctions à l'identique (`affinity`, `forYouScore`, `trend`, `pop`, `recoState`, `filmGlobal`, `flushWatch`, `engagement`, `workTags`).
