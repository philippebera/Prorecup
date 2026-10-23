// Départements français et déduction depuis le code postal.

export const DEPARTMENTS: Record<string, string> = {
  "01": "Ain", "02": "Aisne", "03": "Allier", "04": "Alpes-de-Haute-Provence", "05": "Hautes-Alpes",
  "06": "Alpes-Maritimes", "07": "Ardèche", "08": "Ardennes", "09": "Ariège", "10": "Aube", "11": "Aude",
  "12": "Aveyron", "13": "Bouches-du-Rhône", "14": "Calvados", "15": "Cantal", "16": "Charente",
  "17": "Charente-Maritime", "18": "Cher", "19": "Corrèze", "2A": "Corse-du-Sud", "2B": "Haute-Corse",
  "21": "Côte-d'Or", "22": "Côtes-d'Armor", "23": "Creuse", "24": "Dordogne", "25": "Doubs", "26": "Drôme",
  "27": "Eure", "28": "Eure-et-Loir", "29": "Finistère", "30": "Gard", "31": "Haute-Garonne", "32": "Gers",
  "33": "Gironde", "34": "Hérault", "35": "Ille-et-Vilaine", "36": "Indre", "37": "Indre-et-Loire",
  "38": "Isère", "39": "Jura", "40": "Landes", "41": "Loir-et-Cher", "42": "Loire", "43": "Haute-Loire",
  "44": "Loire-Atlantique", "45": "Loiret", "46": "Lot", "47": "Lot-et-Garonne", "48": "Lozère",
  "49": "Maine-et-Loire", "50": "Manche", "51": "Marne", "52": "Haute-Marne", "53": "Mayenne",
  "54": "Meurthe-et-Moselle", "55": "Meuse", "56": "Morbihan", "57": "Moselle", "58": "Nièvre", "59": "Nord",
  "60": "Oise", "61": "Orne", "62": "Pas-de-Calais", "63": "Puy-de-Dôme", "64": "Pyrénées-Atlantiques",
  "65": "Hautes-Pyrénées", "66": "Pyrénées-Orientales", "67": "Bas-Rhin", "68": "Haut-Rhin", "69": "Rhône",
  "70": "Haute-Saône", "71": "Saône-et-Loire", "72": "Sarthe", "73": "Savoie", "74": "Haute-Savoie",
  "75": "Paris", "76": "Seine-Maritime", "77": "Seine-et-Marne", "78": "Yvelines", "79": "Deux-Sèvres",
  "80": "Somme", "81": "Tarn", "82": "Tarn-et-Garonne", "83": "Var", "84": "Vaucluse", "85": "Vendée",
  "86": "Vienne", "87": "Haute-Vienne", "88": "Vosges", "89": "Yonne", "90": "Territoire de Belfort",
  "91": "Essonne", "92": "Hauts-de-Seine", "93": "Seine-Saint-Denis", "94": "Val-de-Marne", "95": "Val-d'Oise",
  "971": "Guadeloupe", "972": "Martinique", "973": "Guyane", "974": "La Réunion", "976": "Mayotte",
};

export function departmentFromPostalCode(postalCode: string): string | null {
  const pc = postalCode.trim();
  if (!/^\d{5}$/.test(pc)) return null;
  if (pc.startsWith("97")) {
    const d = pc.slice(0, 3);
    return DEPARTMENTS[d] ? d : null;
  }
  if (pc.startsWith("20")) {
    // Corse : 200xx-201xx → 2A, 202xx-206xx → 2B
    return Number(pc.slice(2, 3)) <= 1 ? "2A" : "2B";
  }
  const d = pc.slice(0, 2);
  return DEPARTMENTS[d] ? d : null;
}

export function departmentName(code: string): string {
  return DEPARTMENTS[code] ?? code;
}

export function departmentSlug(code: string): string {
  return `${code.toLowerCase()}-${departmentName(code)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

export function departmentFromSlug(slug: string): string | null {
  const code = slug.split("-")[0]?.toUpperCase();
  if (!code || !DEPARTMENTS[code]) return null;
  return departmentSlug(code) === slug ? code : null;
}

/** Zone approximative affichée avant déblocage : commune + département, jamais l'adresse. */
export function approximateZone(city: string, postalCode: string): string {
  const dep = departmentFromPostalCode(postalCode);
  return dep ? `${city} (${departmentName(dep)}, ${dep})` : city;
}
