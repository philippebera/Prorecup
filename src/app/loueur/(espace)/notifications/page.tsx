import { PageTitle, Alert } from "@/components/ui";
import { requirePageProvider } from "@/lib/auth/server";
import { emailConfigured, pushConfigured, smsConfigured } from "@/lib/integrations";
import { PushToggle } from "@/components/client";
import { PrefsForm } from "./client";

export default async function NotifPrefsPage() {
  const { company } = await requirePageProvider("/loueur/notifications");
  return (
    <>
      <PageTitle title="Préférences de notification" subtitle="Préférences communes à l'entreprise. Les notifications de nouvelles demandes ne contiennent jamais de coordonnées ni d'adresse exacte." />
      <div className="mb-4 space-y-2">
        {!emailConfigured() && <Alert tone="warn">L&apos;envoi d&apos;emails n&apos;est pas configuré sur la plateforme : aucune alerte email n&apos;est envoyée pour le moment.</Alert>}
        {!smsConfigured() && <Alert tone="info">Aucun fournisseur SMS n&apos;est configuré : les alertes SMS sont indisponibles.</Alert>}
      </div>
      <PrefsForm initial={{
        notifyEmail: company.notifyEmail, notifySms: company.notifySms, notifyPush: company.notifyPush,
        notifyQuietStart: company.notifyQuietStart, notifyQuietEnd: company.notifyQuietEnd, smsPhone: company.smsPhone ?? "",
      }} smsAvailable={smsConfigured()} />
      <div className="card mt-6">
        <h2 className="mb-2 font-bold">Notifications push sur cet appareil</h2>
        <PushToggle configured={pushConfigured()} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""} />
      </div>
    </>
  );
}
