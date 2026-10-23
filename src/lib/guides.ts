// Guides pratiques (contenu éditorial). Les ordres de grandeur sont indicatifs :
// chaque loueur précise ses propres conditions. À relire avant mise en production.

export type GuideSection = { h: string; p?: string[]; list?: string[] };
export type Guide = { slug: string; title: string; description: string; updated: string; sections: GuideSection[] };

export const GUIDES: Guide[] = [
  {
    slug: "choisir-volume-benne",
    title: "Quel volume de benne choisir ?",
    description: "Repères pour estimer le volume de vos déchets et choisir une taille de benne adaptée.",
    updated: "2026-10-01",
    sections: [
      { h: "Les tailles les plus courantes", p: ["Les loueurs proposent généralement des bennes de 3 m³ à 30 m³. Les dimensions exactes et les tailles disponibles varient d'une entreprise à l'autre : demandez-les au loueur avant la pose."], list: ["3 à 6 m³ : petit débarras, rénovation d'une pièce, déchets lourds en petite quantité (gravats).", "8 à 10 m³ : rénovation de plusieurs pièces, débarras de maison, gros travaux de jardin.", "15 à 30 m³ : chantiers importants, démolition partielle, déchets volumineux et légers (bois, cartons, encombrants)."] },
      { h: "Volume et poids : deux limites différentes", p: ["Les déchets lourds comme les gravats remplissent rarement une grande benne : le poids maximal transportable est atteint avant. Pour ce type de déchets, une petite benne est souvent plus adaptée. Les déchets légers et encombrants (meubles, branchages) occupent au contraire beaucoup de volume pour un poids faible."] },
      { h: "Estimer son volume", list: ["Mesurez grossièrement le tas (longueur × largeur × hauteur) : un tas de 2 m × 1,5 m × 1 m représente environ 3 m³.", "Ajoutez une marge : les déchets mal rangés occupent plus de place.", "Une benne ne doit pas être remplie au-dessus de ses bords.", "En cas de doute, choisissez « Je ne sais pas » : les loueurs vous conseilleront."] },
    ],
  },
  {
    slug: "dechets-acceptes-benne",
    title: "Quels déchets peut-on mettre dans une benne ?",
    description: "Gravats, déchets verts, bois, tout-venant : ce qui est généralement accepté, et ce qui ne l'est pas.",
    updated: "2026-10-01",
    sections: [
      { h: "Trier pour payer le juste prix", p: ["Les loueurs proposent souvent des bennes dédiées à un type de déchets (gravats, déchets verts, bois) et des bennes « tout-venant » pour les mélanges. Une benne triée est en général moins chère à traiter. Un mélange non annoncé peut entraîner un surcoût : décrivez précisément vos déchets."] },
      { h: "Généralement acceptés", list: ["Gravats inertes : béton, briques, tuiles, carrelage, pierres, terre non polluée.", "Déchets verts : tontes, branchages, feuilles.", "Bois : palettes, planches, meubles en bois.", "Tout-venant de chantier : plastiques, métaux, cartons, laine de verre, menuiseries.", "Plâtre : souvent dans une benne dédiée."] },
      { h: "Généralement refusés en benne classique", list: ["Amiante : elle relève d'une filière spécialisée et de règles particulières.", "Produits dangereux : peintures, solvants, produits chimiques, huiles.", "Bouteilles de gaz, extincteurs, batteries, piles.", "Pneus, déchets médicaux, ordures ménagères.", "Appareils électriques et électroménager : filière dédiée (DEEE)."], p: ["Chaque loueur fixe ses propres règles d'acceptation : vérifiez-les avec lui."] },
    ],
  },
  {
    slug: "poids-benne-gravats",
    title: "Poids des déchets et facturation à la tonne",
    description: "Pourquoi le poids compte, comment les loueurs le facturent, et les questions à poser.",
    updated: "2026-10-01",
    sections: [
      { h: "Pourquoi le poids compte", p: ["Le traitement des déchets est souvent facturé au poids. Selon les loueurs, un poids est inclus dans le prix, ou bien les déchets sont facturés au réel après pesée, avec un prix par tonne."] },
      { h: "Ordres de grandeur", p: ["À titre purement indicatif, un mètre cube de gravats pèse nettement plus d'une tonne, alors qu'un mètre cube de déchets verts ou d'encombrants pèse beaucoup moins. Le poids réel dépend fortement de la nature et de l'humidité des déchets."] },
      { h: "Questions à poser au loueur", list: ["Quel poids est inclus dans le prix ?", "Quel est le prix par tonne supplémentaire ?", "Comment la pesée est-elle justifiée ?", "Quels suppléments sont possibles (jour supplémentaire, déchets non conformes, attente) ?"] },
      { h: "Sur cette plateforme", p: ["Le poids final de vos déchets n'a aucune incidence sur la mise en relation, qui est gratuite pour vous. Les offres envoyées par les loueurs indiquent le poids inclus ou la facturation au réel, ainsi que le prix par tonne supplémentaire."] },
    ],
  },
  {
    slug: "autorisation-voirie-benne",
    title: "Poser une benne sur la voie publique : l'autorisation",
    description: "Quand une autorisation est nécessaire, à qui la demander, et comment préparer son dossier.",
    updated: "2026-10-01",
    sections: [
      { h: "Quand faut-il une autorisation ?", p: ["Si la benne est posée sur un terrain privé (cour, allée, jardin), aucune autorisation de voirie n'est en principe nécessaire. Si elle est posée sur la voie publique (rue, trottoir, place de stationnement), une autorisation d'occupation temporaire du domaine public est généralement exigée."] },
      { h: "À qui s'adresser ?", p: ["La demande se fait le plus souvent auprès de la mairie de la commune. Selon la voie concernée, le gestionnaire peut être une autre collectivité (métropole, département). Renseignez-vous auprès de votre mairie : elle vous indiquera le service compétent et le formulaire à utiliser."] },
      { h: "Délais et frais", p: ["Les délais d'instruction et les éventuelles redevances varient selon les collectivités. Anticipez votre demande plusieurs jours, voire plusieurs semaines, avant la date de pose. Une autorisation demandée n'est pas une autorisation accordée : attendez la réponse de l'autorité."] },
      { h: "Notre assistant", p: ["Lorsque vous indiquez une pose sur la voie publique, un assistant vous aide à rassembler les informations (emplacement, dates, dimensions, plan, photos) et à générer un dossier récapitulatif en PDF. Il ne remplace pas la démarche officielle : la plateforme n'est pas un service administratif."] },
    ],
  },
  {
    slug: "louer-benne-particulier",
    title: "Louer une benne quand on est particulier",
    description: "Les étapes, les informations à préparer et les points à vérifier dans une offre.",
    updated: "2026-10-01",
    sections: [
      { h: "Préparez votre demande", list: ["L'adresse exacte et l'emplacement prévu (terrain privé ou voie publique).", "Les dates de pose et de retrait souhaitées, et si elles sont flexibles.", "La nature des déchets et une estimation du volume.", "Les contraintes d'accès : rue étroite, portail, hauteur limitée, sol meuble."] },
      { h: "Comparez les offres", p: ["Une offre complète précise le volume de la benne, les déchets autorisés et exclus, ce qui est inclus (pose, transport, retrait), le nombre de jours, le poids inclus ou la facturation au réel, les prix supplémentaires, les montants HT et TTC et la durée de validité."] },
      { h: "Le paiement", p: ["Le prix et le paiement de la location sont convenus directement entre vous et le loueur. La plateforme ne prélève aucune commission et ne vous facture rien."] },
    ],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug) ?? null;
}
