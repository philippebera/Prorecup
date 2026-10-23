import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Notifications internes en temps réel (Server-Sent Events). Le serveur interroge
// la base toutes les 5 s ; adapté à un déploiement mono-instance ou peu chargé.
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return new Response("Non autorisé", { status: 401 });
  let since = new Date(Date.now() - 1000);
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      const unread = await prisma.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } });
      send("unread", { count: unread });
      const timer = setInterval(async () => {
        try {
          const items = await prisma.notification.findMany({
            where: { userId: user.id, channel: "IN_APP", createdAt: { gt: since } },
            orderBy: { createdAt: "asc" },
            take: 20,
            select: { id: true, title: true, body: true, link: true, createdAt: true },
          });
          if (items.length) {
            since = items[items.length - 1].createdAt;
            for (const n of items) send("notification", n);
            send("unread", { count: await prisma.notification.count({ where: { userId: user.id, channel: "IN_APP", readAt: null } }) });
          } else controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(timer);
          controller.close();
        }
      }, 5000);
      req.signal.addEventListener("abort", () => {
        clearInterval(timer);
        try { controller.close(); } catch {}
      });
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
}
