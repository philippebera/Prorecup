import type { NextRequest } from "next/server";
import { processQueue } from "@/lib/notifications/queue";
import { safeEqual } from "@/lib/crypto";
import { purgeExpiredData } from "@/lib/retention";

// À appeler périodiquement (ex. toutes les minutes) par un planificateur externe :
// Authorization: Bearer $CRON_SECRET
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Non autorisé", { status: 401 });
  const queue = await processQueue(100);
  const purge = req.nextUrl.searchParams.get("purge") === "1" ? await purgeExpiredData() : null;
  return Response.json({ queue, purge });
}
export const GET = handle;
export const POST = handle;
