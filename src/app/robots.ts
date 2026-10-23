import type { MetadataRoute } from "next";
import { APP_URL } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/suivi", "/loueur/", "/admin", "/connexion", "/notifications", "/invitation", "/mot-de-passe"] }],
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
