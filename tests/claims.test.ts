import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { unlockRequest } from "@/lib/unlock";
import { createClaim, resolveClaim } from "@/lib/claims";
import { clientSetStatus } from "@/lib/requests/service";
import { admin, balance, makeCompany, makePublishedRequest, resetDb } from "./helpers";

beforeEach(resetDb);

async function setup() {
  const c = await makeCompany();
  const { request } = await makePublishedRequest();
  const u = await unlockRequest({ requestId: request.id, companyId: c.company.id, userId: c.user.id, confirmed: true });
  return { ...c, request, unlockId: u.unlockId };
}

describe("Réclamations et restitution de crédit", () => {
  it("restitue exactement 1 crédit avec justification, une seule fois", async () => {
    const { company, user, unlockId } = await setup();
    expect(await balance(company.id)).toBe(2);
    const claim = await createClaim({ unlockId, companyId: company.id, userId: user.id, reason: "INVALID_CONTACT", details: "Numéro non attribué, email en erreur" });
    const a = await admin();
    await expect(resolveClaim({ claimId: claim.id, adminId: a.id, accept: true, resolution: "" })).rejects.toMatchObject({ code: "REASON_REQUIRED" });
    await resolveClaim({ claimId: claim.id, adminId: a.id, accept: true, resolution: "Numéro vérifié inexistant" });
    await expect(resolveClaim({ claimId: claim.id, adminId: a.id, accept: true, resolution: "Deuxième tentative" })).rejects.toMatchObject({ code: "ALREADY_RESOLVED" });
    expect(await balance(company.id)).toBe(3);
    const entries = await prisma.creditLedgerEntry.findMany({ where: { companyId: company.id, type: "RESTITUTION" } });
    expect(entries).toHaveLength(1);
    expect(entries[0].reason).toBe("Numéro vérifié inexistant");
    expect(await prisma.auditLog.count({ where: { action: "CLAIM_ACCEPTED" } })).toBe(1);
  });

  it("refus : aucun crédit restitué", async () => {
    const { company, user, unlockId } = await setup();
    const claim = await createClaim({ unlockId, companyId: company.id, userId: user.id, reason: "MISMATCH", details: "Le client a choisi un concurrent" });
    await resolveClaim({ claimId: claim.id, adminId: (await admin()).id, accept: false, resolution: "Le choix d'un concurrent n'ouvre pas droit à restitution" });
    expect(await balance(company.id)).toBe(2);
  });

  it("refuse un signalement hors délai, en double ou d'une autre entreprise", async () => {
    const { company, user, unlockId } = await setup();
    const other = await makeCompany();
    await expect(createClaim({ unlockId, companyId: other.company.id, userId: other.user.id, reason: "FRAUDULENT", details: "pas mon déblocage" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await prisma.unlock.update({ where: { id: unlockId }, data: { createdAt: new Date(Date.now() - 8 * 86400_000) } });
    await expect(createClaim({ unlockId, companyId: company.id, userId: user.id, reason: "FRAUDULENT", details: "Signalement trop tardif" })).rejects.toMatchObject({ code: "CLAIM_WINDOW_CLOSED" });
    await prisma.unlock.update({ where: { id: unlockId }, data: { createdAt: new Date() } });
    await createClaim({ unlockId, companyId: company.id, userId: user.id, reason: "FRAUDULENT", details: "Demande manifestement fausse" });
    await expect(createClaim({ unlockId, companyId: company.id, userId: user.id, reason: "FRAUDULENT", details: "Encore une fois" })).rejects.toMatchObject({ code: "CLAIM_EXISTS" });
  });

  it("une demande fermée après déblocage garde la trace et reste examinable", async () => {
    const { company, user, unlockId, request } = await setup();
    await clientSetStatus(request.id, "close");
    expect(await prisma.unlock.count({ where: { requestId: request.id } })).toBe(1);
    const claim = await createClaim({ unlockId, companyId: company.id, userId: user.id, reason: "INVALID_CONTACT", details: "Injoignable après fermeture" });
    expect(claim.status).toBe("OPEN");
  });
});
