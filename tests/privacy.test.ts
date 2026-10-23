import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getPreviewForCompany, getUnlockedDetails, listPreviewsForCompany } from "@/lib/requests/views";
import { unlockRequest } from "@/lib/unlock";
import { makeCompany, makePublishedRequest, resetDb } from "./helpers";

beforeEach(resetDb);

const SECRETS = (r: { email: string | null; phone: string | null }) => [r.email!, r.phone!, "0611223344", "06 11 22 33 44", "+33611223344", "12 rue Secrète", "Jeanne Secret", "Code portail 1234", "Appelez-moi"];

describe("Aucune coordonnée avant déblocage", () => {
  it("aperçus (liste et détail) et notifications sans données privées", async () => {
    const { company } = await makeCompany();
    const { request } = await makePublishedRequest();
    const list = JSON.stringify(await listPreviewsForCompany(company.id));
    const one = JSON.stringify(await getPreviewForCompany(request.id, company.id));
    const notifs = JSON.stringify(await prisma.notification.findMany({ where: { companyId: company.id } }));
    for (const s of SECRETS(request)) {
      expect(list).not.toContain(s);
      expect(one).not.toContain(s);
      expect(notifs).not.toContain(s);
    }
    expect(one).toContain("Lyon");
    expect(await getUnlockedDetails(request.id, company.id)).toBeNull();
  });

  it("après déblocage : seuls les canaux choisis et vérifiés", async () => {
    const { company, user } = await makeCompany();
    const { request } = await makePublishedRequest({ contactPreference: "EMAIL", phone: "0611223344" });
    expect(request.phone).toBeNull(); // canal non choisi : non conservé
    await unlockRequest({ requestId: request.id, companyId: company.id, userId: user.id, confirmed: true });
    const d = await getUnlockedDetails(request.id, company.id);
    expect(d && !d.expired && d.email).toBe(request.email);
    expect(d && !d.expired && d.phone).toBeNull();
    expect(d && !d.expired && d.addressLine).toBe("12 rue Secrète");
  });

  it("une autre entreprise ne voit pas les données débloquées par une première", async () => {
    const a = await makeCompany();
    const b = await makeCompany();
    const { request } = await makePublishedRequest();
    await unlockRequest({ requestId: request.id, companyId: a.company.id, userId: a.user.id, confirmed: true });
    expect(await getUnlockedDetails(request.id, b.company.id)).toBeNull();
  });

  it("une entreprise non destinataire ne voit même pas l'aperçu", async () => {
    await makeCompany();
    const { request } = await makePublishedRequest();
    const outsider = await makeCompany({ deps: ["13"] });
    expect(await getPreviewForCompany(request.id, outsider.company.id)).toBeNull();
    expect(await listPreviewsForCompany(outsider.company.id)).toHaveLength(0);
  });
});
