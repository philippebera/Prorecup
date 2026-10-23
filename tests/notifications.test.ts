import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { enqueue, nextAllowedTime, processQueue } from "@/lib/notifications/queue";
import { makeCompany, makePublishedRequest, resetDb } from "./helpers";

beforeEach(resetDb);

describe("Notifications", () => {
  it("canal non configuré : enregistré comme non envoyé, jamais annoncé comme envoyé", async () => {
    const { company } = await makeCompany();
    await prisma.company.update({ where: { id: company.id }, data: { notifySms: true, smsPhone: "+33600000000" } });
    await makePublishedRequest();
    const rows = await prisma.notification.findMany({ where: { companyId: company.id, kind: "NEW_REQUEST" } });
    const byChannel = Object.fromEntries(rows.map((r) => [r.channel, r.status]));
    expect(byChannel.IN_APP).toBe("SENT");
    expect(byChannel.EMAIL).toBe("SKIPPED_NOT_CONFIGURED");
    expect(byChannel.SMS).toBe("SKIPPED_NOT_CONFIGURED");
    const r = await processQueue();
    expect(r.sent).toBe(0);
    expect(await prisma.notification.count({ where: { channel: { not: "IN_APP" }, status: "SENT" } })).toBe(0);
  });

  it("déduplication par clé", async () => {
    const items = [{ channel: "IN_APP" as const, kind: "T", dedupeKey: "k1", title: "t", body: "b" }];
    expect(await enqueue(prisma, items)).toBe(1);
    expect(await enqueue(prisma, items)).toBe(0);
  });

  it("si le fournisseur devient indisponible au moment de l'envoi : statut non configuré", async () => {
    process.env.SMTP_HOST = "smtp.invalid";
    process.env.SMTP_FROM = "x@test.invalid";
    await enqueue(prisma, [{ channel: "EMAIL", kind: "T", dedupeKey: "e1", toAddress: "a@test.invalid", title: "t", body: "b" }]);
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_FROM;
    await processQueue();
    const n = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: "e1" } });
    expect(n.status).toBe("SKIPPED_NOT_CONFIGURED");
  });

  it("échec d'envoi : nouvelle tentative programmée puis échec définitif", async () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "1"; // port fermé
    process.env.SMTP_FROM = "x@test.invalid";
    try {
      await enqueue(prisma, [{ channel: "EMAIL", kind: "T", dedupeKey: "e2", toAddress: "a@test.invalid", title: "t", body: "b" }]);
      await processQueue();
      let n = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: "e2" } });
      expect(n.status).toBe("PENDING");
      expect(n.attempts).toBe(1);
      expect(n.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
      for (let i = 0; i < 5; i++) {
        await prisma.notification.update({ where: { id: n.id }, data: { nextAttemptAt: new Date(0) } });
        await processQueue();
      }
      n = await prisma.notification.findUniqueOrThrow({ where: { dedupeKey: "e2" } });
      expect(n.status).toBe("FAILED");
      expect(n.lastError).toBeTruthy();
    } finally {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_FROM;
      delete process.env.SMTP_PORT;
    }
  });

  it("respecte la plage de silence du loueur", () => {
    // 23 h à Paris en hiver = 22 h UTC
    const t = new Date("2026-01-15T22:00:00Z");
    const next = nextAllowedTime(t, 21, 7, "Europe/Paris");
    expect(next.toISOString()).toBe("2026-01-16T06:00:00.000Z"); // 7 h Paris
    expect(nextAllowedTime(new Date("2026-01-15T10:00:00Z"), 21, 7, "Europe/Paris").toISOString()).toBe("2026-01-15T10:00:00.000Z");
  });
});
