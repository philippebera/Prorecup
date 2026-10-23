import type { NextRequest } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import { handleStripeEvent } from "@/lib/payments";
import { AppError } from "@/lib/errors";

// Point d'entrée des webhooks Stripe : corps brut + vérification de signature.
// Seul ce point (et non la redirection du navigateur) déclenche l'ajout de crédits.
export async function POST(req: NextRequest) {
  const raw = await req.text();
  try {
    const event = constructWebhookEvent(raw, req.headers.get("stripe-signature"));
    const outcome = await handleStripeEvent(event);
    return Response.json({ received: true, outcome });
  } catch (e) {
    if (e instanceof AppError) return Response.json({ error: e.code }, { status: e.status });
    console.error("Webhook Stripe", e);
    return Response.json({ error: "INTERNAL" }, { status: 500 }); // Stripe réessaiera
  }
}
