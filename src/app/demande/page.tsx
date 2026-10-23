import type { Metadata } from "next";
import { Container } from "@/components/ui";
import { RequestWizard } from "./wizard";
import { getSettings } from "@/lib/settings";
import { channelAvailable } from "@/lib/requests/service";

export const metadata: Metadata = {
  title: "Décrire mon besoin de benne",
  description: "Déposez gratuitement votre demande de location de benne : adresse, dates, déchets et volume.",
  alternates: { canonical: "/demande" },
};
export const dynamic = "force-dynamic";

export default async function DemandePage() {
  const settings = await getSettings();
  return (
    <Container className="max-w-2xl py-6 sm:py-10">
      <RequestWizard
        maxUnlocks={settings.maxUnlocksPerRequest}
        emailAvailable={channelAvailable("EMAIL")}
        phoneAvailable={channelAvailable("PHONE")}
        captchaSiteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null}
      />
    </Container>
  );
}
