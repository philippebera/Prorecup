# Benne Direct

Application de mise en relation entre demandeurs (particuliers, professionnels)
et entreprises de location de bennes à déchets en France.

- Le demandeur décrit son besoin **gratuitement**, sans mot de passe.
- Les loueurs adaptés (zone, déchets, volume, services) voient un **aperçu sans
  coordonnées ni adresse exacte**.
- Un loueur utilise **1 crédit** pour débloquer les coordonnées ; **3 entreprises
  au maximum** par demande.
- Le prix et le paiement de la location se règlent **directement** entre client et
  loueur. La plateforme vend uniquement des **packs de crédits** (Stripe Checkout),
  sans commission.

Le nom « Benne Direct » est provisoire : il se change via `NEXT_PUBLIC_BRAND_NAME`.

---

## Architecture

Un seul projet **Next.js 15 (App Router, TypeScript)** — rendu serveur pour les pages,
route handlers pour l'API — avec **PostgreSQL** via **Prisma**. Pas de microservice.

```
src/
  app/                 pages (SSR) et API (app/api/**)
    demande/           parcours client en étapes
    suivi/             espace de suivi client (lien temporaire ou compte)
    loueur/            inscription et espace loueur
    admin/             administration
    guides/ zones/ loueurs/ legal/   pages publiques indexables
  lib/                 logique métier (testée indépendamment de l'UI)
    requests/views.ts  FRONTIÈRE DE CONFIDENTIALITÉ (aperçu vs données débloquées)
    unlock.ts          déblocage atomique (verrou + contraintes)
    credits.ts         registre de crédits (seul point d'écriture)
    payments.ts        Stripe Checkout + webhooks idempotents
    notifications/     file d'envoi (email SMTP, SMS Twilio, Web Push)
    permits.ts         assistant d'autorisation de voirie + PDF
prisma/                schéma, migrations, données initiales / démo
scripts/               worker de notifications, création admin, test e2e
tests/                 tests d'intégration (Vitest, base PostgreSQL réelle)
```

Choix principaux :

- **Crédits = registre** (`CreditLedgerEntry`, écriture seule par déclencheur SQL,
  référence unique par opération) + solde matérialisé (`CreditWallet`, `CHECK balance >= 0`)
  mis à jour dans la même transaction.
- **Plafond de 3** garanti par `SELECT … FOR UPDATE` sur la demande, une contrainte
  `UNIQUE(requestId, companyId)` et `CHECK unlockCount <= maxUnlocks`. Toute erreur
  annule la transaction : aucun crédit n'est retiré si la place n'est plus libre.
- **Confidentialité** : l'aperçu est construit par une liste blanche de colonnes ;
  les coordonnées, l'adresse et les textes libres ne sont même pas lus avant déblocage.
  Fichiers privés hors du dossier public, servis par URL signée HMAC (10 min).
- **Authentification** : sessions en cookie httpOnly (jeton haché en base), mots de
  passe scrypt ; clients sans compte via **lien de suivi** temporaire et révocable
  (jeton haché, durée paramétrable) ; contrôle d'origine (CSRF) sur toutes les
  mutations ; limitation de débit en base.
- **Notifications** : file en base (déduplication, reprises avec backoff, historique) ;
  un canal non configuré est enregistré `SKIPPED_NOT_CONFIGURED`, jamais « envoyé ».
  Temps réel dans l'app par Server-Sent Events + pop-up.

## Démarrage local

Prérequis : Node.js ≥ 20, PostgreSQL ≥ 14.

```bash
npm install
cp .env.example .env            # puis renseigner APP_SECRET, DATABASE_URL…
npx prisma migrate deploy       # crée le schéma (2 migrations)
npm run db:seed                 # packs de crédits
npm run db:seed:demo            # (facultatif) données de démonstration isolées
npm run admin:create -- vous@exemple.fr "Votre nom"   # affiche le mot de passe généré
npm run dev                     # http://localhost:3000
npm run worker                  # (autre terminal) envoi des notifications
```

En développement, sans fournisseur email/SMS et avec `DEV_LOG_OTP=true`, les codes
de vérification sont **écrits dans la console du serveur** (rien n'est envoyé).
Ce mode est ignoré quand `NODE_ENV=production`.

**Données de démonstration** : 4 entreprises « DÉMO » (Rhône/Ain/Isère), comptes
`loueur1@demo.invalid` … `loueur4@demo.invalid` et `admin@demo.invalid`, mot de passe
`demo-password-123`. Elles sont marquées `isDemo`, n'apparaissent dans aucune page
publique ni statistique, et ne reçoivent jamais de vraies demandes (et inversement).
Le seed démo refuse de s'exécuter en production.

## Tests

```bash
# base de test dédiée (recréée à chaque exécution)
createdb bennedirect_test
DATABASE_URL_TEST=postgresql://…/bennedirect_test npm test
```

50 tests d'intégration sur PostgreSQL réel, notamment :

| Scénario demandé | Fichier |
|---|---|
| Demande et coordonnées vérifiées (les 2 canaux si « les deux ») | `tests/requests.test.ts` |
| Validation du loueur, crédits offerts attribués une seule fois (y compris validations simultanées et même SIREN) | `tests/companies.test.ts` |
| Achat Stripe test et ajout unique des crédits | `tests/payments.test.ts` |
| Déblocage et débit unique | `tests/unlock.test.ts` |
| Deux utilisateurs d'une même entreprise en simultané | `tests/unlock.test.ts` |
| Plusieurs loueurs simultanés pour la 3e place | `tests/unlock.test.ts` |
| Demande fermée pendant le paiement d'un pack | `tests/unlock.test.ts` |
| Absence de coordonnées avant achat | `tests/privacy.test.ts` + e2e |
| Restitution de crédit | `tests/claims.test.ts` |
| Paiement échoué, remboursement, webhook reçu plusieurs fois, contestation | `tests/payments.test.ts` |
| Notification non configurée | `tests/notifications.test.ts` |
| Dossier voirie envoyé sans être présenté comme accordé | `tests/permits.test.ts` |

**Test de bout en bout HTTP** (`scripts/e2e-smoke.ts`) : contre un serveur lancé, il
parcourt inscription loueur → validation admin → demande → vérification des codes →
destinataires → consentement → diffusion, contrôle que **aucune réponse HTML/RSC/JSON**
reçue par le loueur ne contient email, téléphone, nom, adresse ou textes libres avant
déblocage, puis débloque, envoie une offre, teste le webhook Stripe signé (et rejoué)
via HTTP. Mode d'emploi en tête du fichier.

## Déploiement

N'importe quel hébergement Node.js + PostgreSQL managé (ex. un PaaS avec base
Postgres) :

1. Variables d'environnement de `.env.example` (secrets dans le gestionnaire de
   secrets de l'hébergeur, jamais dans le dépôt). `APP_URL` = URL publique.
2. `npm ci && npm run build && npx prisma migrate deploy && npm run db:seed`
3. Lancer `npm start` (web) et `npm run worker` (processus séparé) **ou**, en
   serverless, appeler chaque minute `POST /api/cron/notifications` avec
   `Authorization: Bearer $CRON_SECRET` (ajouter `?purge=1` une fois par jour pour
   l'anonymisation selon les durées de conservation).
4. `STORAGE_DIR` doit pointer vers un **volume persistant** (photos, plans,
   autorisations). Sur un hébergement sans disque persistant, remplacer
   `src/lib/storage.ts` par un stockage objet privé (S3 compatible).
5. Stripe : créer un endpoint webhook vers `https://VOTRE_DOMAINE/api/stripe/webhook`
   avec les événements `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`,
   `checkout.session.expired`, `payment_intent.payment_failed`, `charge.succeeded`,
   `charge.refunded`, `charge.dispute.created`, `charge.dispute.closed`.
   En local : `stripe listen --forward-to localhost:3000/api/stripe/webhook` puis
   reporter le `whsec_…` affiché dans `STRIPE_WEBHOOK_SECRET`.
6. Créer l'administrateur (`npm run admin:create`), renseigner l'identité de
   l'exploitant dans `/admin/parametres`, compléter les documents légaux.

## Services externes

| Service | Rôle | Variables | Sans configuration |
|---|---|---|---|
| **PostgreSQL** (requis) | base de données | `DATABASE_URL` | l'application ne démarre pas |
| **Stripe** (requis pour vendre) | packs de crédits, Checkout + webhooks, mode test | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PAYMENT_METHODS` | achat désactivé, signalé aux loueurs et à l'admin |
| **SMTP** (requis en production) | codes de vérification email, alertes, liens de suivi | `SMTP_*` | aucun email ; vérification email impossible en production |
| **Twilio** (facultatif) | codes SMS, alertes SMS plafonnées | `SMS_PROVIDER=twilio`, `TWILIO_*`, `SMS_*_CAP` | contact par téléphone non vérifiable → choix « email » seul proposé en production |
| **Web Push / VAPID** (facultatif) | notifications push | `VAPID_*`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | bouton push désactivé |
| **Cloudflare Turnstile** (facultatif) | anti-robot sur le dépôt | `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | champ piège + délai minimal + limitation de débit |
| **Planificateur** (serverless) | file de notifications, purge | `CRON_SECRET` | utiliser `npm run worker` |

L'état de chaque intégration (configurée / dernière utilisation réussie) est affiché
dans `/admin/integrations`.

## Ce qui a été vérifié — et ce qui ne l'a pas été

Vérifié dans cet environnement : migrations, 50 tests d'intégration, build de
production, test de bout en bout HTTP (y compris webhook Stripe signé avec un secret
de test local), rendu mobile des pages principales.

**Non vérifié** (aucune clé disponible ici) : appels réels à l'API Stripe
(création d'une session Checkout en mode test, réception d'un vrai webhook),
envoi réel d'emails SMTP, SMS Twilio et notifications push. Le SDK Stripe installé
(v23, API `2026-09-30`) utilise `allowed_payment_method_types` pour Checkout : à
valider avec votre compte Stripe en mode test avant la mise en production.

## Limites connues

- Notifications temps réel par SSE avec interrogation de la base toutes les 5 s :
  convient à une instance unique ; au-delà, passer par un bus (Redis, Postgres
  LISTEN/NOTIFY).
- Stockage des fichiers sur disque local ; pas d'antivirus ni de suppression des
  métadonnées EXIF (GPS) des photos — visibles seulement après déblocage, mais à
  traiter avant production.
- Zones par département ou code postal (pas de rayon kilométrique ; le géocodage
  n'est pas utilisé pour la sélection).
- Aucun modèle de formulaire officiel de voirie n'est livré (`KNOWN_FORM_TEMPLATES`
  vide) : l'annuaire des autorités est à constituer et vérifier par l'administration.
- Pas de messagerie interne client ↔ loueur (échanges par téléphone/email et offre
  structurée dans l'application).
- Factures : PDF généré par l'application ; mentions légales complémentaires et
  conformité (facturation électronique) à faire valider.
- Documents légaux et politique commerciale : gabarits à compléter
  (`src/lib/legal.ts`, `docs/POLITIQUE-COMMERCIALE.md`).
