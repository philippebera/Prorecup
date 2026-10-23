# Politique commerciale — À COMPLÉTER ET VALIDER AVANT MISE EN PRODUCTION

Ce document liste les décisions commerciales et juridiques que l'application
n'invente pas. Une fois validées, reportez-les dans `src/lib/legal.ts`
(pages publiques) et cochez « Politique commerciale validée » dans
`/admin/parametres`.

## Déjà implémenté (paramétrable dans /admin/parametres)

| Règle | Valeur initiale |
|---|---|
| Crédits par déblocage | 1 |
| Entreprises maximum par demande | 3 (figé sur la demande au moment de sa diffusion) |
| Crédits de découverte | 3, une seule fois par SIREN, après validation admin |
| Packs | 5 crédits 45 € HT · 15 crédits 120 € HT · 40 crédits 280 € HT |
| TVA | 20 % |
| Abonnement / recharge automatique | Aucun |
| Expiration des crédits | Aucune |
| Délai de signalement | 7 jours après déblocage |
| Durée d'accès à un contact débloqué | 365 jours |
| Frais pour le demandeur | Aucun |

## À décider

1. **Restitution de crédit** : critères précis d'acceptation pour chaque motif
   (preuves demandées, nombre d'appels, délai de réponse du client…).
2. **Remboursement monétaire d'un pack** : conditions (crédits non utilisés ?
   délai ? droit de rétractation applicable ou non entre professionnels ?),
   prorata, traitement des crédits offerts.
3. **Contestations (chargebacks)** : suspension automatique ou non du compte,
   traitement des crédits déjà consommés (le système n'annule que le solde
   disponible et signale le reste pour examen).
4. **Suspension / exclusion d'un loueur** : sort des crédits restants.
5. **Mentions obligatoires des factures** (pénalités de retard, indemnité
   forfaitaire de recouvrement, mentions TVA…) — à ajouter dans
   `src/lib/invoices.ts`.
6. **Identité de l'exploitant** (raison sociale, SIRET, TVA, RCS, capital,
   adresse) — à saisir dans `/admin/parametres`. Tant qu'elle est vide, aucune
   facture n'est émise.
7. **Durées de conservation** des demandes et des journaux, base légale des
   traitements (RGPD), registre des traitements.
8. **Vérifications d'entreprise exigées** avant validation (SIRET actif,
   assurance, autorisations de collecte/transport de déchets…).
