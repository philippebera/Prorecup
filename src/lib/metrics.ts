import { prisma } from "./db";

// Indicateurs d'administration. On distingue strictement :
//  - les revenus encaissés (paiements Stripe confirmés, moins remboursements) ;
//  - les crédits consommés (déblocages) ;
//  - le chiffre d'affaires des locations, que la plateforme ne connaît pas (non affiché).

export async function adminMetrics(sinceDays = 30) {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  const nonDemo = { isDemo: false };

  const [byZone, unlocks, published, noUnlock, firstUnlockRows, firstOfferRows, claims, claimsAccepted, purchases, balances, pendingCompanies, openClaims, failedNotifs, reviewPurchases] = await Promise.all([
    prisma.request.groupBy({ by: ["departmentCode"], where: { ...nonDemo, publishedAt: { gte: since } }, _count: true, orderBy: { _count: { departmentCode: "desc" } }, take: 15 }),
    prisma.unlock.count({ where: { createdAt: { gte: since }, request: nonDemo } }),
    prisma.request.count({ where: { ...nonDemo, publishedAt: { gte: since } } }),
    prisma.request.count({ where: { ...nonDemo, publishedAt: { gte: since, lt: new Date(Date.now() - 2 * 86400_000) }, unlockCount: 0 } }),
    prisma.$queryRaw<{ avg_hours: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (u.first - r."publishedAt")) / 3600)::float AS avg_hours
      FROM "Request" r JOIN (SELECT "requestId", MIN("createdAt") AS first FROM "Unlock" GROUP BY "requestId") u ON u."requestId" = r.id
      WHERE r."isDemo" = false AND r."publishedAt" >= ${since}`,
    prisma.$queryRaw<{ avg_hours: number | null }[]>`
      SELECT AVG(EXTRACT(EPOCH FROM (o.first - r."publishedAt")) / 3600)::float AS avg_hours
      FROM "Request" r JOIN (SELECT "requestId", MIN("createdAt") AS first FROM "Offer" GROUP BY "requestId") o ON o."requestId" = r.id
      WHERE r."isDemo" = false AND r."publishedAt" >= ${since}`,
    prisma.claim.count({ where: { createdAt: { gte: since } } }),
    prisma.claim.count({ where: { createdAt: { gte: since }, status: "ACCEPTED" } }),
    prisma.purchase.findMany({ where: { paidAt: { gte: since } }, select: { priceHtCents: true, priceTtcCents: true, refundedCents: true, credits: true, company: { select: { isDemo: true } } } }),
    prisma.creditWallet.findMany({ where: { company: nonDemo }, include: { company: { select: { legalName: true, id: true } } }, orderBy: { balance: "desc" }, take: 50 }),
    prisma.company.count({ where: { status: "PENDING" } }),
    prisma.claim.count({ where: { status: "OPEN" } }),
    prisma.notification.count({ where: { status: "FAILED" } }),
    prisma.purchase.count({ where: { needsAdminReview: true } }),
  ]);
  const unlockLedger = await prisma.creditLedgerEntry.aggregate({ where: { type: "UNLOCK", createdAt: { gte: since }, company: nonDemo }, _sum: { amount: true } });
  const real = purchases.filter((p) => !p.company.isDemo);
  return {
    sinceDays,
    verifiedRequestsByZone: byZone.map((z) => ({ dep: z.departmentCode, count: z._count })),
    published,
    unlocks,
    creditsConsumed: -(unlockLedger._sum.amount ?? 0),
    requestsWithoutUnlock48h: noUnlock,
    avgHoursToFirstUnlock: firstUnlockRows[0]?.avg_hours ?? null,
    avgHoursToFirstOffer: firstOfferRows[0]?.avg_hours ?? null,
    restitutionRate: claims ? claimsAccepted / Math.max(unlocks, 1) : 0,
    claims,
    claimsAccepted,
    packsSold: real.length,
    creditsSold: real.reduce((s, p) => s + p.credits, 0),
    revenueHtCents: real.reduce((s, p) => s + p.priceHtCents, 0),
    revenueTtcCollectedCents: real.reduce((s, p) => s + p.priceTtcCents - p.refundedCents, 0),
    refundedCents: real.reduce((s, p) => s + p.refundedCents, 0),
    balances: balances.map((b) => ({ companyId: b.company.id, name: b.company.legalName, balance: b.balance })),
    todo: { pendingCompanies, openClaims, failedNotifs, reviewPurchases },
  };
}
