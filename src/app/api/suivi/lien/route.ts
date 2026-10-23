import type { NextRequest } from "next/server";
import { z } from "zod";
import { api, body, limit, ok } from "@/lib/http";
import { resendTrackingLink } from "@/lib/requests/service";

export const POST = api(async (req: NextRequest) => {
  await limit(req, "resend-link", 5, 3600);
  const { identifier } = await body(req, z.object({ identifier: z.string().trim().min(5).max(200) }));
  await resendTrackingLink(identifier);
  // Réponse identique dans tous les cas (pas de divulgation de l'existence d'une demande).
  return ok({ message: "Si une demande vérifiée correspond, un nouveau lien vient d'être programmé à l'envoi." });
});
