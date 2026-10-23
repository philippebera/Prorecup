import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { approveCompany, registerCompany } from "@/lib/companies";
import { reconcile } from "@/lib/credits";
import { admin, balance, makeCompany, resetDb, uniqueSiret } from "./helpers";

beforeEach(resetDb);

describe("Validation du loueur et crédits offerts", () => {
  it("n'attribue les crédits de découverte qu'une seule fois, même validée plusieurs fois", async () => {
    const { company } = await makeCompany({ approve: false });
    expect(await balance(company.id)).toBe(0);
    const a = await admin();
    const r1 = await approveCompany(company.id, a.id);
    const r2 = await approveCompany(company.id, a.id);
    expect(r1.granted).toBe(3);
    expect(r2.granted).toBe(0);
    expect(await balance(company.id)).toBe(3);
    expect((await reconcile(company.id)).ok).toBe(true);
  });

  it("validations simultanées : une seule attribution", async () => {
    const { company } = await makeCompany({ approve: false });
    const a = await admin();
    const results = await Promise.allSettled([approveCompany(company.id, a.id), approveCompany(company.id, a.id), approveCompany(company.id, a.id)]);
    const granted = results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ granted: number }>).value.granted);
    expect(granted.reduce((s, g) => s + g, 0)).toBe(3);
    expect(await balance(company.id)).toBe(3);
  });

  it("un second compte avec le même SIREN (autre établissement) ne reçoit pas de crédits offerts et est signalé", async () => {
    const siren = "552100554";
    const first = await makeCompany({ siret: uniqueSiret(siren) });
    expect(await balance(first.company.id)).toBe(3);
    const second = await makeCompany({ siret: uniqueSiret(siren), approve: false });
    const fresh = await prisma.company.findUniqueOrThrow({ where: { id: second.company.id } });
    expect(fresh.duplicateFlags).toContain("SAME_SIREN");
    const r = await approveCompany(second.company.id, (await admin()).id);
    expect(r.granted).toBe(0);
    expect(await balance(second.company.id)).toBe(0);
  });

  it("refuse un SIRET déjà inscrit et un SIRET invalide", async () => {
    const siret = uniqueSiret();
    await makeCompany({ siret });
    await expect(makeCompany({ siret })).rejects.toMatchObject({ code: "SIRET_TAKEN" });
    await expect(registerCompany({ siret: "12345678901234" })).rejects.toBeTruthy();
  });

  it("un loueur non validé ne peut rien débloquer (voir unlock.test) et n'a aucun crédit", async () => {
    const { company } = await makeCompany({ approve: false });
    expect((await prisma.company.findUniqueOrThrow({ where: { id: company.id } })).status).toBe("PENDING");
    expect(await balance(company.id)).toBe(0);
  });
});
