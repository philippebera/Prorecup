import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { unlockRequest } from "@/lib/unlock";
import { clientSetStatus } from "@/lib/requests/service";
import { reconcile } from "@/lib/credits";
import { addMember, balance, makeCompany, makePublishedRequest, resetDb } from "./helpers";

beforeEach(resetDb);

describe("Déblocage et débit unique", () => {
  it("débite exactement 1 crédit, puis reste accessible sans nouveau débit", async () => {
    const { company, user } = await makeCompany();
    const { request } = await makePublishedRequest();
    const r1 = await unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true });
    expect(r1.status).toBe("UNLOCKED");
    expect(await balance(company.id)).toBe(2);
    const r2 = await unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true });
    expect(r2.status).toBe("ALREADY_UNLOCKED");
    expect(await balance(company.id)).toBe(2);
    const ledger = await prisma.creditLedgerEntry.findMany({ where: { companyId: company.id, type: "UNLOCK" } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amount).toBe(-1);
    expect((await reconcile(company.id)).ok).toBe(true);
  });

  it("exige une confirmation explicite", async () => {
    const { company, user } = await makeCompany();
    const { request } = await makePublishedRequest();
    await expect(unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: false })).rejects.toMatchObject({ code: "CONFIRMATION_REQUIRED" });
    expect(await balance(company.id)).toBe(3);
  });

  it("deux utilisateurs d'une même entreprise achetant simultanément : un seul déblocage, un seul débit", async () => {
    const { company, user } = await makeCompany();
    const other = await addMember(company.id);
    const { request } = await makePublishedRequest();
    const results = await Promise.allSettled([
      unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true }),
      unlockRequest({ requestId: request.id, companyId: company.id, userId: other.id, confirmed: true }),
      unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true }),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);
    const statuses = results.map((r) => (r as PromiseFulfilledResult<{ status: string }>).value.status).sort();
    expect(statuses).toEqual(["ALREADY_UNLOCKED", "ALREADY_UNLOCKED", "UNLOCKED"]);
    expect(await balance(company.id)).toBe(2);
    expect(await prisma.unlock.count({ where: { requestId: request.id } })).toBe(1);
    expect((await prisma.request.findUniqueOrThrow({ where: { id: request.id } })).unlockCount).toBe(1);
  });

  it("plusieurs loueurs simultanés pour la troisième place : un seul gagnant, aucun débit pour les autres", async () => {
    const companies = [];
    for (let i = 0; i < 7; i++) companies.push(await makeCompany());
    const { request } = await makePublishedRequest();
    // deux places déjà prises
    for (const c of companies.slice(0, 2)) await unlockRequest({ requestId: request.id, companyId: c.company.id, userId: c.user.id, confirmed: true });
    const racers = companies.slice(2);
    const results = await Promise.allSettled(racers.map((c) => unlockRequest({ requestId: request.id, companyId: c.company.id, userId: c.user.id, confirmed: true })));
    const winners = results.filter((r) => r.status === "fulfilled");
    const losers = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(winners).toHaveLength(1);
    expect(losers.every((l) => l.reason.code === "REQUEST_FULL")).toBe(true);
    const balances = await Promise.all(racers.map((c) => balance(c.company.id)));
    expect(balances.sort()).toEqual([2, 3, 3, 3, 3]);
    const r = await prisma.request.findUniqueOrThrow({ where: { id: request.id } });
    expect(r.unlockCount).toBe(3);
    expect(await prisma.unlock.count({ where: { requestId: request.id } })).toBe(3);
  });

  it("la contrainte en base empêche tout dépassement du plafond", async () => {
    await makeCompany();
    const { request } = await makePublishedRequest();
    await expect(prisma.request.update({ where: { id: request.id }, data: { unlockCount: 4 } })).rejects.toBeTruthy();
  });

  it("demande fermée pendant le paiement d'un pack : aucun débit, aucun accès", async () => {
    const { company, user } = await makeCompany();
    const { request } = await makePublishedRequest();
    // solde épuisé → le loueur part acheter un pack…
    await prisma.$transaction(async (tx) => {
      const { applyLedger } = await import("@/lib/credits");
      await applyLedger(tx, { companyId: company.id, type: "ADMIN_ADJUSTMENT", amount: -3, reference: "test:drain", reason: "test" });
    });
    await expect(unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true })).rejects.toMatchObject({ code: "INSUFFICIENT_CREDITS" });
    // …pendant ce temps le client ferme sa demande, puis le pack est crédité
    await clientSetStatus(request.id, "close");
    await prisma.$transaction(async (tx) => {
      const { applyLedger } = await import("@/lib/credits");
      await applyLedger(tx, { companyId: company.id, type: "PURCHASE", amount: 5, reference: "test:pack" });
    });
    await expect(unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true })).rejects.toMatchObject({ code: "REQUEST_UNAVAILABLE" });
    expect(await balance(company.id)).toBe(5);
    expect(await prisma.unlock.count({ where: { requestId: request.id } })).toBe(0);
  });

  it("demande suspendue (arrêt des nouveaux contacts) : déblocage impossible", async () => {
    const { company, user } = await makeCompany();
    const { request } = await makePublishedRequest();
    await clientSetStatus(request.id, "pause");
    await expect(unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true })).rejects.toMatchObject({ code: "REQUEST_UNAVAILABLE" });
    expect(await balance(company.id)).toBe(3);
  });

  it("refuse une entreprise non destinataire ou non validée", async () => {
    await makeCompany();
    const { request } = await makePublishedRequest();
    const late = await makeCompany(); // inscrite après la diffusion : pas destinataire
    await expect(unlockRequest({ requestId: request.id, companyId: late.company.id, userId: late.user.id, confirmed: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const c = await makeCompany();
    const { request: r2 } = await makePublishedRequest();
    await prisma.company.update({ where: { id: c.company.id }, data: { status: "SUSPENDED" } });
    await expect(unlockRequest({ requestId: r2.id, companyId: c.company.id, userId: c.user.id, confirmed: true })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await balance(c.company.id)).toBe(3);
  });

  it("le registre est en écriture seule", async () => {
    const { company } = await makeCompany();
    const entry = await prisma.creditLedgerEntry.findFirstOrThrow({ where: { companyId: company.id } });
    await expect(prisma.creditLedgerEntry.update({ where: { id: entry.id }, data: { amount: 100 } })).rejects.toBeTruthy();
    await expect(prisma.creditLedgerEntry.delete({ where: { id: entry.id } })).rejects.toBeTruthy();
  });
});
