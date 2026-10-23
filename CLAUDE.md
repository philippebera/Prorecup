# CLAUDE.md — « Cercle » : web app (Vite + React + TypeScript, PWA, Netlify)

Ce fichier est la spécification de travail du projet. État d'avancement : `PROGRESS.md`.

## 1. Mission

**Cercle est et reste une web app (PWA) pour l'instant — pas d'application native, pas de publication sur les stores.** L'application actuelle est un **unique fichier HTML d'environ 3 000 lignes** (`reference/web-app-index.html`) déployé à la main sur Netlify (site `cercle-films-livres`).

Dans cet ordre :
1. **Reconstruire l'app en projet web propre** (modules, types, tests, déploiement automatique) avec **exactement les mêmes fonctionnalités et le même backend Supabase** (aucune régression, aucune migration de données).
2. **Terminer ce qui manque** avant l'ouverture aux premiers amis (§11 « Chantiers en plus »).
3. **Préparer l'avenir** sans le construire : logique métier dans `src/domain`, **indépendante du navigateur** (réutilisable par Expo/React Native).

Le fichier de référence est la **spécification exécutable** : en cas de divergence sur un détail, **il fait foi**. Interface en **français** (chaînes dans `src/i18n/fr.ts`).

**Pile** : Vite + React 18 + TypeScript strict + React Router + TanStack Query + Tailwind CSS (tokens en variables CSS) + Vitest + Playwright + ESLint/Prettier. PWA via `vite-plugin-pwa` (`injectManifest`, service worker maison `src/sw.ts` pour les notifications). Déploiement Netlify relié au dépôt Git (aperçu à chaque branche).

## 2. Le produit

Réseau social de **recommandation de films et de livres en vidéo**. Des **créateurs** choisis par l'admin publient de courtes critiques vidéo (ou photos) avec une note sur 10. Les **membres** (inscrits puis validés par l'admin) regardent un feed vertical « Pour toi », notent, créent des listes, recommandent à leurs amis, découvrent par genre ou hashtag. **Affinité de goûts** entre membres pour personnaliser le feed. **Rien n'est visible sans compte validé.**

## 3. Backend existant (NE PAS le recréer)

- Supabase : ref `vrzfuegtcmpehlroogvf`, région `eu-west-3`. Variables : voir `.env.example` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` publique, `VITE_VAPID_PUBLIC_KEY` publique). Jamais de clé de service dans le code.
- Auth Supabase : seule e-mail + mot de passe est activée aujourd'hui. Google / Facebook / SMS plus tard : n'afficher que les méthodes activées, lues via `GET {SUPABASE_URL}/auth/v1/settings` (champ `external`).
- Tables : `public.docs` (générique), `public.admins`, `public.app_config` (privée).
- Storage : bucket public `media`, 50 Mo max, types `video/mp4|webm|quicktime`, `image/jpeg|png|webp`. Fichiers d'un utilisateur dans `media/{auth.uid()}/...`. URL publique : `{SUPABASE_URL}/storage/v1/object/public/media/{path}`.
- Edge Function `notify` (Web Push) : **pas encore déployée** (validation humaine requise). §9.

### 3.1 Table `docs`

```
docs(collection text, id text, data jsonb, owner uuid default auth.uid(), created_at, updated_at, primary key (collection, id))
```
Lecture : `from('docs').select('id,data').eq('collection','posts')`. Écriture : `upsert({collection,id,data},{onConflict:'collection,id'})`. Temps réel : `postgres_changes` sur `public.docs` (respecte RLS). Id = aléatoire (20 car.) ou clé composée `a--b`.

### 3.2 Collections

| collection | id | data |
|---|---|---|
| `members` | `uid` | `uid, pseudo, bio, joinedAt, status` (`pending`\|`approved`\|`rejected`) |
| `profiles` (**privé**) | `uid` | `uid, age, sex, favFilms[], favBooks[], email, phone, provider, createdAt, updatedAt` |
| `creators` (admin) | `uid` | `uid, perWeek (1-3), since` |
| `works` | aléatoire | `type` (`film`\|`book`), `title, creator, year, genre, synopsis, cover` (admin seulement), `addedBy, createdAt` |
| `posts` | aléatoire | `workId, uid, type, genre, tags[], media[], caption, rating, details{direction,script,acting,photo}, seen, status, rejectReason, featured, featuredAt, createdAt` — `media[i] = {kind:'video'\|'image', id, poster, w, h, duration}` |
| `reviews` | `{workId}--{uid}` | `workId, uid, rating (/10), scale:10, text, details, seen, createdAt, updatedAt` |
| `likes` | `{target}--{uid}` | `target` (post ou avis), `uid, at` |
| `saves` | `{postId}--{uid}` | `target:postId, uid, at` |
| `comments` | aléatoire | `target, uid, text, replyTo?, createdAt` |
| `recos` | aléatoire | `workId, postId?, from, to, msg, status?` (`declined`), `createdAt` |
| `views` | `{postId}--{uid}--{YYYY-MM-DD}` | `target, creator, viewer, day, month, seconds, qualified, completed, updatedAt` |
| `lists` (**privé**) | `{uid}-watch`, `{uid}-fav` ou aléatoire | `uid, name, items[workId], createdAt, updatedAt` |
| `sessions` (**privé**) | `{uid}--{YYYY-MM-DD}` | `uid, day, seconds, opens, last, pwa, device` |
| `push` (**privé**) | `{uid}-{hash}` | `uid, sub, ua, createdAt` |
| `reports` (**privé**) | aléatoire | `uid, target:postId, targetType:'post', reason, createdAt` |
| `blocks` (**privé**) | `{uid}--{blockedUid}` | `uid, blocked, createdAt` |

Genres films : Drame, Comédie, Thriller, Science-fiction, Horreur, Romance, Animation, Documentaire, Action. Genres livres : Roman, Polar, SF & fantasy, Essai, BD & manga, Feel-good, Développement perso, Poésie.
« Où vu » films : Cinéma, Netflix, Prime Video, Disney+, Canal+, Apple TV+, Max, Arte, Autre ; livres : Papier, Liseuse, Audio, Bibliothèque, Emprunté.

### 3.3 Règles d'accès côté base (ne pas contourner ni « réparer » côté client)

- Non validé : ne lit que ses documents, n'écrit que `members`, `profiles`, `push`.
- Validé : lit tout sauf `profiles, sessions, push, lists, reports, blocks` des autres ; ne voit que les `posts` `approved` (plus les siens).
- Trigger `docs_guard` : `members.status` forcé `pending` à la création puis inchangé ; `posts` créés seulement par un créateur, toujours `pending`, sans `featured`, non modifiables ensuite ; `works.cover` vide pour les non-admins ; seul `works.genre` complétable s'il est vide.
- Admin (table `admins`) : écrit `creators`, valide/refuse, met à la une, pose les affiches ; exempté des garde-fous.
- RPC : `is_admin()`, `is_approved()`, `delete_my_account()` (refuse pour le propriétaire), `claim_admin()`.
- Trigger `docs_notify` → Edge Function `notify` (post_submitted, post_approved, post_rejected, member_pending, member_approved), secret `app_config.webhook_secret`.
- **Toute modification du schéma/règles : migration SQL dans `supabase/migrations/`, proposée à l'humain avant exécution. Ne jamais désactiver RLS.**

## 4. Règles métier (à reproduire à l'identique ; voir `affinity`, `forYou`, `forYouScore`, `trend`, `pop`, `recoState`, `filmGlobal`, `flushWatch`, `engagement`, `workTags` dans la référence)

- **Notes** : films = réalisation, scénario, acting obligatoires /10 + photo facultative ; globale = moyenne des trois, arrondie à 0,1. Livres : une note /10. Anciens avis `scale` ≠ 10 : `rating × 2`.
- **Affinité** : ≥ 3 œuvres notées en commun ; écart moyen absolu `m` ; `max(0, round(100 × (1 − m/6)))`.
- **Estimation pour vous** : moyenne des notes des autres pondérée par `(affinité/100)² + 0,01`.
- **Popularité** : `likes + 2×commentaires + 3×enregistrements + 2×recos + 0,3×vues qualifiées + 2×tauxFin×min(vues,10)/10`.
- **Tendance** : `(featured ? 3 : 1) × (pop+1) / (heures + 6)^1,15`.
- **Pour toi** : `tendance × (1 + affinité créateur/100 si connue) × (0,55 si déjà noté) × (0,4 si ma vidéo) × (6 si à la une) × (1,35 si genre préféré)`.
- Onglets feed : Pour toi / Tendances / Nouveaux ; filtres Tout / Films / Livres ; sous-filtres de genre.
- **Vue qualifiée** : ≥ 3 s regardées (ou 50 % si durée < 6 s), une par spectateur/post/jour, jamais ses propres vidéos ; secondes plafonnées à `max(30, 3×durée)` (90 pour photos) ; terminée à 90 % ; envoi toutes les 15 s et à la mise en arrière-plan.
- **Temps passé** : battement 5 s au premier plan, enregistré par minute dans `sessions/{uid}--{jour}`.
- **Listes** : « À voir » et « Favoris » + personnelles ; ajout depuis une vidéo → créer/supprimer `saves/{postId}--{uid}` selon présence dans au moins une liste.
- **Recos** : réussie si note du destinataire ≥ 7, ratée si < 7, en attente sinon, « pas pour moi » si refusée ; taux de réussite par ami.
- **Hashtags** : `#([\p{L}\p{N}_-]{2,40})`, normalisés (minuscules, sans accents) ; recherche en ET ; nuage ; hashtags liés.
- **Doublons d'œuvres** : recherche par `type + titre normalisé` avant création.
- **Créateurs** : `perWeek` ; série = semaines consécutives atteignant l'objectif ; Studio (vues, temps, durée moyenne, % jusqu'au bout, spectateurs uniques, détail par vidéo, en validation).
- **Inscription** : pseudo, âge (≥ 15), sexe (Femme / Homme / Autre / Je préfère ne pas le dire), genres préférés (≥ 1). Puis écran d'attente ; à `approved`, **recharger toutes les données**.
- **Pas d'affiche utilisateur** : si `cover` vide, couverture générée (film/livre).

## 5. Écrans

1. Connexion / inscription (e-mail + mdp, mot de passe oublié, boutons OAuth/SMS conditionnels).
2. Onboarding, attente, refusé.
3. Pour toi : feed plein écran vertical, lecture auto, préchargement, muet par défaut (tap = son), pastille de note en haut à droite, affiche en bas à droite, rail d'actions (profil, j'aime, commentaires, liste, envoyer), légende + hashtags, « Vu : Netflix », notes détaillées, badge « À la une », « Donner ma note ».
4. Recherche : champ (titre, auteur, `#thème`), grille par genre (lance le lecteur), nuage, top 5 films/livres, « Demander au cercle » désactivé.
5. Publier (créateurs) : vidéo (filmer/galerie/photos), œuvre, notes + où vu, genre + légende + hashtags → `pending`.
6. Studio (créateurs).
7. Profil : listes, recos (taux), membres + affinité, notifications, goûts, supprimer le compte, déconnexion.
8. Feuilles : fiche œuvre, commentaires (réponses), listes, recommander, noter.
9. Admin `/admin` (lazy, noindex, `is_admin()`), porté depuis `reference/web-admin-index.html` + onglet « Signalements ».

## 6. Design

Dribbble/Pinterest : fonds désaturés, grands arrondis (22–34 px, pilules), verre dépoli, air, **Manrope** (300 titres `-0.03em`, 700–800 libellés), accent terre cuite. Palette claire : fond `#E9E9EC`, surface `#FFFFFF`, surface 2 `#F4F4F6`, encre `#000`, encre 2 `#4A4A50`, discret `#8C8C94`, accent `#C4623A`, clair `#E3A27F`, pâle `#F2D4C0`, foncé `#8F4325`. Sombre auto : fond `#000`, surface `#17171A`, surface 2 `#222226`, encre `#FFF`. **Feed toujours sombre.** Icônes PWA (192, 512, maskable 512, apple-touch 180, favicon 32) depuis `reference/icon-1024.png`. Onglets : Pour toi · Recherche · Publier · Studio · Profil (pastille recos). Mobile d'abord (iPhone PWA). Accessibilité : cibles ≥ 44 px, AA, libellés, reduced-motion.

## 7. Architecture

```
src/domain/      logique PURE + tests (aucun import React/DOM/Supabase)
src/data/        adaptateur typé `docs`, types, hooks TanStack Query (src/data/hooks), temps réel
src/features/    feed, search, publish, studio, profile, lists, comments, recos, onboarding, auth, admin
src/components/  UI partagée
src/lib/         client supabase, media, push, pwa, session tracking
src/i18n/fr.ts
```
- Session persistée (localStorage), `detectSessionInUrl`, `redirectTo = window.location.origin`.
- Adaptateur `listDocs/getDoc/setDoc/updateDoc/deleteDoc/subscribe`. **Ne pas charger des collections entières** : paginer ; agrégats via fonctions SQL `security definer` en lecture seule (migration à valider).
- Une route par écran ; feuilles et lecteur plein écran en routes/overlays avec bouton retour.
- Tests : formules §4 en unitaires ; Playwright sur parcours critiques **avec backend simulé** — jamais la production.
- ESLint interdit DOM/React dans `domain/` et `data/` (hors `data/hooks`).

## 8. Vidéo

Un seul lecteur actif, poster immédiat, préchargement suivante (+ métadonnées suivante+1), libération hors écran, `playsinline`, muet au départ. Compression appareil : 720p (1280 grand côté), ~2 Mbit/s, MP4 H.264/AAC, ≤ 3 min, ≤ 50 Mo ; WebCodecs + muxer MP4, repli `MediaRecorder`, puis envoi tel quel si ≤ 50 Mo ; poster (1re seconde). `.mov` iPhone : `blob.slice(0, blob.size, 'video/mp4')` (le type envoyé est celui du Blob). Envoi résumable TUS (`/storage/v1/upload/resumable`, `tus-js-client`). Interface `MediaProvider` (futur Bunny/Cloudflare Stream + hls.js).

## 9. Notifications

SW : `push` + `notificationclick` (focus/ouvre, navigue vers `data.url`). Abonnement `PushManager.subscribe({userVisibleOnly:true, applicationServerKey})` → doc `push` `{uid}-{hash endpoint}` ; désabonnement = suppression + `unsubscribe()`. iPhone : app installée (iOS 16.4+), permission depuis un geste ; aide d'installation ; pas de bouton « Activer » si non installée. Lien profond `/#post={id}`. Edge Function `notify` à **proposer** (Verify JWT désactivé) puis tester.

## 10. Conformité

Pages légales (textes **fournis par le propriétaire**, ne pas inventer) + case CGU à l'inscription. Supprimer mon compte : fichiers `media/{uid}/` puis `rpc('delete_my_account')` puis déconnexion ; export JSON. Âge ≥ 15. Pas de cookie de suivi. Signaler (vidéo, commentaire → `reports`), Bloquer (`blocks`, masque le contenu), contact visible. Affiches : admin seulement, sources autorisées.

## 11. Jalons

0. Lecture/plan + outillage. 1. Domain + data. 2. Socle UI + auth. 3. Accès (onboarding/attente). 4. Feed + interactions. 5. Recherche + fiche œuvre. 6. Publier + Studio. 7. Profil, notifications, PWA. 8. Admin. 9. Signaler/bloquer/suppression/export, légal, signalements admin, agrégats SQL + pagination, e2e. 10. Durcissement (Lighthouse, RLS en transaction annulée, comparaison), bascule.

Fin de jalon : TypeScript sans erreur, tests verts, aperçu Netlify OK, `PROGRESS.md` à jour (fait / reste / à tester sur appareil).

## 12. Règles de collaboration

- Aucun secret dans le dépôt (service role, VAPID privée, OAuth, Twilio). Seules des valeurs publiques en `VITE_*`.
- Base : migrations dans `supabase/migrations/` validées par le propriétaire ; lecture seule d'abord ; tests RLS en transaction annulée.
- Ne pas casser la production : l'ancien site reste en ligne.
- Ne pas simplifier §4 ; en cas de doute, lire la référence.
- Ne jamais dire « testé » pour ce qui n'a pas été exécuté (iPhone, push, installation PWA, OAuth/SMS).
- Vérifier maintenance/compatibilité avant toute nouvelle dépendance.
- Questions seulement si architecture ou décision irréversible.

## Commandes

`npm run dev` · `npm run check` (typecheck + lint + format + tests) · `npm run build` · `npm run e2e` (dans le conteneur cloud : `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome npm run e2e`).
