export function dateFr(d: Date | string | null | undefined, withTime = false) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d.length === 10 ? `${d}T12:00:00Z` : d) : d;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Europe/Paris" });
}

export function shortDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Paris" });
}

export const REQUEST_STATUS: Record<string, { label: string; tone: "green" | "gray" | "amber" | "red" | "blue" }> = {
  DRAFT: { label: "Brouillon", tone: "gray" },
  PUBLISHED: { label: "Diffusée", tone: "green" },
  PAUSED: { label: "Nouveaux contacts arrêtés", tone: "amber" },
  FULFILLED: { label: "Loueur trouvé", tone: "blue" },
  CLOSED: { label: "Fermée", tone: "gray" },
  CANCELLED: { label: "Annulée", tone: "gray" },
  ARCHIVED: { label: "Archivée", tone: "red" },
};

export const PLACEMENT_LABEL: Record<string, string> = { PRIVATE: "Terrain privé", PUBLIC_ROAD: "Voie publique", UNKNOWN: "Emplacement à préciser" };
export const CONTACT_LABEL: Record<string, string> = { PHONE: "Téléphone", EMAIL: "Email", BOTH: "Téléphone et email" };
export const CLIENT_TYPE_LABEL: Record<string, string> = { INDIVIDUAL: "Particulier", PROFESSIONAL: "Professionnel" };
