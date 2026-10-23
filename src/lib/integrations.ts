// État des intégrations externes, déterminé uniquement à partir de la configuration.
// « configuré » ne signifie pas « vérifié en conditions réelles » : l'administration
// affiche les deux notions séparément (voir /admin/integrations).

export type IntegrationStatus = { key: string; label: string; configured: boolean; required: boolean; detail: string };

export const isProd = () => process.env.NODE_ENV === "production";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET);
}
export function stripeTestMode() {
  return (process.env.STRIPE_SECRET_KEY || "").startsWith("sk_test_");
}
export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}
export function smsConfigured() {
  return (
    process.env.SMS_PROVIDER === "twilio" &&
    Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM)
  );
}
export function pushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT && process.env.VAPID_SUBJECT !== "mailto:");
}
export function captchaConfigured() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
}
/** En développement, les codes de vérification peuvent être écrits dans la console du serveur. */
export function devOtpLogging() {
  return !isProd() && process.env.DEV_LOG_OTP === "true";
}

export function integrationStatuses(): IntegrationStatus[] {
  return [
    {
      key: "stripe",
      label: "Stripe Checkout (vente des packs)",
      configured: stripeConfigured(),
      required: true,
      detail: stripeConfigured()
        ? stripeTestMode()
          ? "Clés en mode TEST."
          : "Clés en mode LIVE."
        : "STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET manquants : l'achat de packs est désactivé.",
    },
    {
      key: "email",
      label: "Email transactionnel (SMTP)",
      configured: emailConfigured(),
      required: true,
      detail: emailConfigured()
        ? `Hôte ${process.env.SMTP_HOST}`
        : "SMTP_HOST / SMTP_FROM manquants : aucun email n'est envoyé, vérification par email impossible en production.",
    },
    {
      key: "sms",
      label: "SMS (facultatif)",
      configured: smsConfigured(),
      required: false,
      detail: smsConfigured()
        ? `Fournisseur ${process.env.SMS_PROVIDER}, plafond ${process.env.SMS_DAILY_CAP || 50}/jour`
        : "Aucun fournisseur SMS : vérification du téléphone et alertes SMS indisponibles en production.",
    },
    {
      key: "push",
      label: "Web Push (facultatif)",
      configured: pushConfigured(),
      required: false,
      detail: pushConfigured() ? "Clés VAPID présentes." : "Clés VAPID manquantes : notifications push désactivées.",
    },
    {
      key: "captcha",
      label: "Anti-spam Turnstile (facultatif)",
      configured: captchaConfigured(),
      required: false,
      detail: captchaConfigured() ? "Actif sur le dépôt de demande." : "Désactivé : protection par limitation de débit et champ piège uniquement.",
    },
  ];
}
