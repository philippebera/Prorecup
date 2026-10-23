// Gabarits des documents légaux. AUCUNE identité d'exploitant n'est inventée :
// les mentions entre crochets doivent être complétées puis validées par un juriste
// avant la mise en production.

export type LegalDoc = { slug: string; title: string; sections: { h: string; p: string[] }[] };

const TODO = "⚠ À compléter et faire valider avant mise en production.";

export const LEGAL_DOCS: LegalDoc[] = [
  {
    slug: "mentions-legales",
    title: "Mentions légales",
    sections: [
      { h: "Éditeur du site", p: [TODO, "Raison sociale : [RAISON SOCIALE]", "Forme juridique et capital : [FORME / CAPITAL]", "Siège social : [ADRESSE]", "RCS / SIRET : [N°]", "N° TVA intracommunautaire : [N°]", "Directeur de la publication : [NOM]", "Contact : [EMAIL]"] },
      { h: "Hébergement", p: ["Hébergeur : [NOM, ADRESSE, TÉLÉPHONE DE L'HÉBERGEUR]"] },
      { h: "Nature du service", p: ["Le site est une plateforme de mise en relation entre des demandeurs et des entreprises de location de bennes. La plateforme n'est pas partie aux contrats de location, ne fixe pas les prix des loueurs et n'encaisse pas le prix des locations. Elle n'est pas un service administratif officiel."] },
    ],
  },
  {
    slug: "confidentialite",
    title: "Politique de confidentialité",
    sections: [
      { h: "Responsable du traitement", p: [TODO, "[IDENTITÉ ET COORDONNÉES DU RESPONSABLE DE TRAITEMENT, DPO LE CAS ÉCHÉANT]"] },
      { h: "Données collectées et finalités", p: ["Demandeurs : nom, coordonnées choisies (téléphone et/ou email), adresse du chantier, informations sur le besoin, photos facultatives. Finalité : transmettre la demande aux loueurs adaptés et permettre à trois entreprises au maximum de vous contacter, à votre demande, au sujet de cette demande uniquement.", "Loueurs : informations d'entreprise, utilisateurs, facturation. Finalités : gestion du compte, vente de crédits, facturation, prévention des abus."] },
      { h: "Base légale", p: ["[À DÉTERMINER ET VALIDER : exécution de mesures précontractuelles à la demande de la personne, intérêt légitime, obligations légales comptables…]", "La prospection commerciale par la plateforme repose sur un consentement distinct, facultatif et révocable. Les loueurs ne sont pas autorisés à utiliser vos coordonnées à des fins de prospection."] },
      { h: "Destinataires", p: ["Avant déblocage, les loueurs destinataires ne voient ni vos coordonnées ni votre adresse exacte. Après déblocage (trois entreprises au maximum), l'entreprise concernée accède aux coordonnées des canaux que vous avez choisis et vérifiés, à l'adresse du chantier et aux photos. Vous êtes informé(e) de chaque déblocage.", "Sous-traitants techniques : [HÉBERGEUR, EMAIL, SMS, STRIPE POUR LES PAIEMENTS DES LOUEURS…]"] },
      { h: "Durées de conservation", p: ["Les demandes sont anonymisées automatiquement après la durée paramétrée par l'administration (actuellement [DURÉE]). Les brouillons non diffusés sont anonymisés après 7 jours. Les données comptables sont conservées selon les obligations légales.", "[À VALIDER]"] },
      { h: "Vos droits", p: ["Accès, rectification, effacement, limitation, opposition, portabilité : [MODALITÉS ET CONTACT]. Vous pouvez aussi saisir la CNIL."] },
      { h: "Cookies", p: ["Le site utilise uniquement des cookies techniques nécessaires (session, lien de suivi). Aucun cookie publicitaire ni de mesure d'audience n'est déposé dans cette version. [À METTRE À JOUR SI DES OUTILS SONT AJOUTÉS]"] },
    ],
  },
  {
    slug: "cgu",
    title: "Conditions générales d'utilisation",
    sections: [
      { h: "Objet", p: [TODO, "Les présentes conditions encadrent l'utilisation gratuite du service par les demandeurs."] },
      { h: "Fonctionnement", p: ["Le demandeur décrit son besoin, vérifie ses coordonnées et accepte expressément d'être contacté par trois entreprises au maximum parmi les destinataires présentés. Aucune réponse, disponibilité, délai ou prix n'est garanti. Le prix et le paiement de la location sont convenus directement avec le loueur."] },
      { h: "Gestion de la demande", p: ["Le demandeur peut à tout moment arrêter les nouveaux contacts, fermer ou annuler sa demande, signaler un problème. Une demande fermée ou annulée ne peut plus être débloquée."] },
      { h: "Responsabilité", p: ["[À RÉDIGER ET VALIDER]"] },
    ],
  },
  {
    slug: "conditions-loueurs",
    title: "Conditions loueurs et politique commerciale des crédits",
    sections: [
      { h: "Statut", p: ["⚠ Politique commerciale à compléter et valider avant mise en production (voir docs/POLITIQUE-COMMERCIALE.md)."] },
      { h: "Crédits", p: ["1 crédit permet à une entreprise de débloquer les coordonnées d'une demande. Les crédits sont rattachés à l'entreprise. Des crédits de découverte peuvent être offerts une fois par entreprise (SIREN) après validation. Les crédits n'expirent pas dans la version actuelle. Aucun abonnement ni recharge automatique."] },
      { h: "Déblocage", p: ["Une demande peut être débloquée par trois entreprises distinctes au maximum. Une location n'est pas garantie. Un contact débloqué reste accessible à l'entreprise sans nouveau débit pendant la durée paramétrée."] },
      { h: "Réclamations et restitution", p: ["Un signalement peut être fait dans les sept jours suivant le déblocage pour : coordonnées fausses ou inutilisables, demande frauduleuse, doublon déjà acheté, besoin manifestement différent de l'aperçu, demande hors critères annoncés. L'administration décide de la restitution éventuelle d'un crédit, avec justification. Un refus de devis, le choix d'un concurrent ou l'absence de location n'ouvrent pas droit à restitution.", "La restitution d'un crédit est distincte du remboursement monétaire d'un pack, qui relève de [CONDITIONS À DÉFINIR]."] },
      { h: "Utilisation des coordonnées", p: ["Les coordonnées obtenues ne peuvent être utilisées que pour répondre à la demande concernée. Toute prospection publicitaire, revente ou réutilisation est interdite et peut entraîner la suspension du compte."] },
      { h: "Paiement", p: ["Les packs sont payés par Stripe Checkout. Les crédits sont ajoutés après confirmation du paiement par Stripe. En cas de remboursement ou de contestation, les crédits correspondants sont annulés dans la limite du solde disponible ; les crédits déjà consommés font l'objet d'un examen."] },
    ],
  },
];

export function getLegalDoc(slug: string) {
  return LEGAL_DOCS.find((d) => d.slug === slug) ?? null;
}
