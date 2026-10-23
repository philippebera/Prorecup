import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/brand";
import { GUIDES } from "@/lib/guides";
import { LEGAL_DOCS } from "@/lib/legal";
import { coveredDepartments, publicCompanySlugs } from "@/lib/public-directory";

export const revalidate = 3600;

// Uniquement des pages publiques réelles : aucune demande, compte ou document privé.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [deps, companies] = await Promise.all([coveredDepartments().catch(() => []), publicCompanySlugs().catch(() => [])]);
  return [
    { url: `${APP_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${APP_URL}/demande`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${APP_URL}/guides`, changeFrequency: "monthly", priority: 0.7 },
    ...GUIDES.map((g) => ({ url: `${APP_URL}/guides/${g.slug}`, lastModified: g.updated, priority: 0.7 })),
    { url: `${APP_URL}/zones`, changeFrequency: "weekly" as const, priority: 0.6 },
    ...deps.map((d) => ({ url: `${APP_URL}/zones/${d.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...companies.map((c) => ({ url: `${APP_URL}/loueurs/${c.slug}`, lastModified: c.updatedAt, priority: 0.5 })),
    ...LEGAL_DOCS.map((d) => ({ url: `${APP_URL}/legal/${d.slug}`, priority: 0.2 })),
  ];
}
