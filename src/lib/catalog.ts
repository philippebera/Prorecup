// Référentiels métier affichés dans les formulaires.

export type WasteType = {
  code: string;
  label: string;
  examples: string;
  excluded: string;
  icon: string;
};

export const WASTE_TYPES: WasteType[] = [
  {
    code: "GRAVATS",
    label: "Gravats inertes",
    examples: "Béton, briques, tuiles, carrelage, pierres, terre non polluée",
    excluded: "Plâtre, amiante, bois, plastique",
    icon: "🧱",
  },
  {
    code: "DIB",
    label: "Déchets de chantier en mélange (DIB / tout-venant)",
    examples: "Bois, plastiques, métaux, cartons, laine de verre, menuiseries sans vitrage",
    excluded: "Gravats en quantité, déchets dangereux, amiante",
    icon: "🏗️",
  },
  {
    code: "VERTS",
    label: "Déchets verts",
    examples: "Tontes, branchages, feuilles, souches de petite taille",
    excluded: "Terre, pierres, sacs plastique",
    icon: "🌿",
  },
  {
    code: "BOIS",
    label: "Bois",
    examples: "Palettes, planches, meubles en bois, charpente non traitée",
    excluded: "Bois traité classe 4 (traverses, poteaux), métal en quantité",
    icon: "🪵",
  },
  {
    code: "ENCOMBRANTS",
    label: "Encombrants / débarras",
    examples: "Mobilier, matelas, objets divers d'un débarras de maison ou de cave",
    excluded: "Électroménager (filière DEEE), pots de peinture, bouteilles de gaz",
    icon: "🛋️",
  },
  {
    code: "PLATRE",
    label: "Plâtre",
    examples: "Plaques de plâtre, carreaux de plâtre, enduits",
    excluded: "Gravats, bois, isolants collés",
    icon: "⬜",
  },
  {
    code: "METAUX",
    label: "Métaux / ferraille",
    examples: "Ferraille, profilés, radiateurs métalliques, grillages",
    excluded: "Bouteilles de gaz, batteries, appareils avec fluides",
    icon: "🔩",
  },
  {
    code: "CARTONS",
    label: "Cartons et papiers",
    examples: "Cartons d'emballage, papiers",
    excluded: "Cartons souillés, plastiques",
    icon: "📦",
  },
];

/** Déchets refusés en benne classique : affichés à titre informatif. */
export const GLOBAL_EXCLUSIONS = [
  "Amiante (filière spécialisée obligatoire)",
  "Pots de peinture, solvants, produits chimiques",
  "Bouteilles de gaz, extincteurs",
  "Batteries, piles, huiles",
  "Pneus",
  "Déchets médicaux",
  "Ordures ménagères",
];

export const SKIP_SIZES_M3 = [3, 6, 8, 10, 15, 20, 30];

export const SERVICES = [
  { code: "PUBLIC_ROAD", label: "Pose sur voie publique" },
  { code: "URGENT", label: "Interventions urgentes" },
  { code: "WEEKEND", label: "Pose ou retrait le samedi" },
  { code: "BIG_BAG", label: "Big bags / sacs à gravats" },
  { code: "TIPPER", label: "Camion benne avec chauffeur (rotation)" },
  { code: "PERMIT_HELP", label: "Aide aux démarches d'autorisation de voirie" },
];

export const ACCESS_FLAGS = [
  { code: "NARROW_STREET", label: "Rue étroite" },
  { code: "LOW_HEIGHT", label: "Hauteur limitée (porche, câbles, arbres)" },
  { code: "SLOPE", label: "Terrain en pente" },
  { code: "SOFT_GROUND", label: "Sol meuble (pelouse, terre)" },
  { code: "NO_PARKING", label: "Stationnement difficile" },
  { code: "GATE", label: "Portail ou accès à ouvrir" },
];

export const VOLUME_HINTS: Record<number, string> = {
  3: "Petit débarras, salle de bain",
  6: "Rénovation d'une pièce, petit jardin",
  8: "Rénovation de plusieurs pièces",
  10: "Débarras de maison, gros travaux de jardin",
  15: "Rénovation importante",
  20: "Démolition partielle, chantier professionnel",
  30: "Gros chantier, volumes légers (bois, cartons)",
};

export function wasteLabel(code: string): string {
  return WASTE_TYPES.find((w) => w.code === code)?.label ?? code;
}
export function serviceLabel(code: string): string {
  return SERVICES.find((s) => s.code === code)?.label ?? code;
}
export function accessLabel(code: string): string {
  return ACCESS_FLAGS.find((s) => s.code === code)?.label ?? code;
}
