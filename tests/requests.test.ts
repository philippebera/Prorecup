import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { createDraft, prepareRecipients, publishRequest, sendVerificationCode, verifyCode, clientSetStatus } from "@/lib/requests/service";
import { makeCompany, makePublishedRequest, requestInput, resetDb, verifyChannel } from "./helpers";

beforeEach(resetDb);

describe("Demande client et coordonnées vérifiées", () => {
  it("exige la vérification de TOUS les canaux choisis avant diffusion", async () => {
    await makeCompany();
    const { request } = await createDraft(requestInput({ contactPreference: "BOTH" }));
    await expect(prepareRecipients(request.id)).rejects.toMatchObject({ code: "NOT_VERIFIED" });
    await verifyChannel(request.id, "EMAIL");
    // email seul vérifié : toujours refusé
    await expect(publishRequest(request.id, { contactConsent: true, marketingConsent: false })).rejects.toMatchObject({ code: "NOT_VERIFIED" });
    const mid = await prisma.request.findUniqueOrThrow({ where: { id: request.id } });
    expect(mid.emailVerifiedAt).not.toBeNull();
    expect(mid.phoneVerifiedAt).toBeNull();
    await verifyChannel(request.id, "PHONE");
    const recipients = await prepareRecipients(request.id);
    expect(recipients.length).toBe(1);
    await publishRequest(request.id, { contactConsent: true, marketingConsent: false });
    const r = await prisma.request.findUniqueOrThrow({ where: { id: request.id } });
    expect(r.status).toBe("PUBLISHED");
    expect(r.contactConsentText).toContain("téléphone et email");
    expect(r.contactConsentText).toContain("aucune prospection");
    expect(r.marketingConsent).toBe(false);
  });

  it("refuse la diffusion sans consentement explicite au contact", async () => {
    await makeCompany();
    const { request } = await createDraft(requestInput({ contactPreference: "EMAIL", phone: null }));
    await verifyChannel(request.id, "EMAIL");
    await prepareRecipients(request.id);
    await expect(publishRequest(request.id, { contactConsent: false, marketingConsent: true })).rejects.toMatchObject({ code: "CONSENT_REQUIRED" });
  });

  it("rejette un code incorrect et bloque après 5 essais", async () => {
    const { request } = await createDraft(requestInput({ contactPreference: "EMAIL", phone: null }));
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    await sendVerificationCode(request.id, "EMAIL");
    spy.mockRestore();
    for (let i = 0; i < 5; i++) await expect(verifyCode(request.id, "EMAIL", "000000")).rejects.toBeTruthy();
    await expect(verifyCode(request.id, "EMAIL", "000000")).rejects.toMatchObject({ code: "TOO_MANY_ATTEMPTS" });
  });

  it("n'envoie aucun code et le signale si aucun fournisseur n'est configuré (hors mode dev)", async () => {
    const { request } = await createDraft(requestInput({ contactPreference: "PHONE", email: null }));
    process.env.DEV_LOG_OTP = "false";
    try {
      await expect(sendVerificationCode(request.id, "PHONE")).rejects.toMatchObject({ code: "CHANNEL_NOT_CONFIGURED" });
    } finally {
      process.env.DEV_LOG_OTP = "true";
    }
    const sent = await prisma.notification.count({ where: { requestId: request.id, status: "SENT" } });
    expect(sent).toBe(0);
  });

  it("ne sélectionne que les loueurs adaptés (zone, déchets, volume, voie publique)", async () => {
    const ok = await makeCompany();
    await makeCompany({ deps: ["75"] }); // hors zone
    await makeCompany({ waste: ["VERTS"] }); // déchets non acceptés
    await makeCompany({ sizes: [3] }); // trop petit
    await makeCompany({ services: [] }); // pas de voie publique
    await makeCompany({ approve: false }); // non validé
    const { recipients } = await makePublishedRequest({ placement: "PUBLIC_ROAD", volumeM3: 8 });
    expect(recipients.map((r) => r.id)).toEqual([ok.company.id]);
  });

  it("une demande fermée ne peut plus être rouverte", async () => {
    await makeCompany();
    const { request } = await makePublishedRequest();
    await clientSetStatus(request.id, "close", { reason: "Plus besoin" });
    await expect(clientSetStatus(request.id, "resume")).rejects.toMatchObject({ code: "ALREADY_CLOSED" });
  });

  it("une voie publique crée un dossier d'autorisation à préparer", async () => {
    await makeCompany();
    const { request } = await makePublishedRequest({ placement: "PUBLIC_ROAD" });
    const permit = await prisma.permit.findUnique({ where: { requestId: request.id } });
    expect(permit?.status).toBe("TO_PREPARE");
  });
});
