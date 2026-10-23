import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { permitPdf, sendPermitFromApp, setPermitStatus, updatePermit } from "@/lib/permits";
import { makeCompany, makePublishedRequest, resetDb } from "./helpers";

beforeEach(resetDb);

async function readyPermit(verifiedChannel: boolean) {
  await makeCompany();
  const { request } = await makePublishedRequest({ placement: "PUBLIC_ROAD" });
  const authority = await prisma.permitAuthority.create({
    data: { name: "Mairie test", kind: "MAIRIE", departmentCode: "69", postalCodes: ["69003"], submissionEmail: verifiedChannel ? "voirie@mairie.test.invalid" : null, submissionEmailVerified: verifiedChannel, lastVerifiedAt: new Date() },
  });
  await updatePermit(request.id, { locationDetails: "Devant le n°12, sur 2 places", startDate: "2027-01-10", endDate: "2027-01-12", lengthM: 4, widthM: 2, authorityId: authority.id });
  return request;
}

describe("Autorisation de voirie", () => {
  it("le dossier passe à « Prêt » puis « Envoyé par vous » sans jamais être présenté comme accordé", async () => {
    const request = await readyPermit(false);
    expect((await prisma.permit.findUniqueOrThrow({ where: { requestId: request.id } })).status).toBe("READY");
    await expect(sendPermitFromApp(request.id, true)).rejects.toMatchObject({ code: "NO_VERIFIED_CHANNEL" });
    await setPermitStatus(request.id, "SENT_BY_USER");
    const p = await prisma.permit.findUniqueOrThrow({ where: { requestId: request.id } });
    expect(p.status).toBe("SENT_BY_USER");
    expect(p.status).not.toBe("GRANTED");
    expect(p.decisionAt).toBeNull();
    // « accordé » impossible sans téléverser l'autorisation
    await expect(setPermitStatus(request.id, "GRANTED")).rejects.toMatchObject({ code: "AUTHORIZATION_FILE_REQUIRED" });
  });

  it("transition invalide refusée (prêt → accordé)", async () => {
    const request = await readyPermit(false);
    await expect(setPermitStatus(request.id, "GRANTED")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("canal vérifié mais email non configuré : envoi refusé, rien n'est marqué envoyé", async () => {
    const request = await readyPermit(true);
    await expect(sendPermitFromApp(request.id, false)).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    await expect(sendPermitFromApp(request.id, true)).rejects.toMatchObject({ code: "EMAIL_NOT_CONFIGURED" });
    expect((await prisma.permit.findUniqueOrThrow({ where: { requestId: request.id } })).status).toBe("READY");
  });

  it("génère un PDF récapitulatif", async () => {
    const request = await readyPermit(false);
    const pdf = await permitPdf(request.id);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
