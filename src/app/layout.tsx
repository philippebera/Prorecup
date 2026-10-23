import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BRAND_NAME, APP_URL } from "@/lib/brand";
import { SiteFooter, SiteHeader } from "@/components/site";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${BRAND_NAME} — Location de bennes : recevez des propositions de loueurs`, template: `%s — ${BRAND_NAME}` },
  description: "Décrivez gratuitement votre besoin de benne à déchets. Des loueurs adaptés à votre zone peuvent vous contacter et vous proposer leur tarif.",
  openGraph: { siteName: BRAND_NAME, locale: "fr_FR", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#23774e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="flex min-h-screen flex-col">
        <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Aller au contenu</a>
        <SiteHeader />
        <main id="contenu" className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
