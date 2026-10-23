import Stripe from "stripe";
import { AppError } from "./errors";
import { stripeConfigured } from "./integrations";

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeConfigured()) throw new AppError("STRIPE_NOT_CONFIGURED", "Le paiement en ligne n'est pas encore configuré sur la plateforme.", 503);
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { appInfo: { name: "benne-direct" } });
  return client;
}

/** Vérifie la signature d'un webhook (corps brut obligatoire). */
export function constructWebhookEvent(rawBody: string | Buffer, signature: string | null, secret = process.env.STRIPE_WEBHOOK_SECRET) {
  if (!secret) throw new AppError("STRIPE_NOT_CONFIGURED", "STRIPE_WEBHOOK_SECRET manquant", 503);
  if (!signature) throw new AppError("BAD_SIGNATURE", "Signature absente", 400);
  try {
    return Stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    throw new AppError("BAD_SIGNATURE", "Signature de webhook invalide", 400);
  }
}
