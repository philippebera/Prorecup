import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { departmentName } from "../geo";
import { signedFileUrl } from "../storage";

// ============================================================================
// FRONTIÈRE DE CONFIDENTIALITÉ
// Toute donnée de demande envoyée à un loueur passe par ces fonctions.
// L'aperçu utilise une liste blanche de colonnes : les coordonnées, l'adresse
// exacte, les textes libres (susceptibles de contenir des coordonnées) et les
// photos ne sont même pas lues depuis la base.
// ============================================================================

export const PREVIEW_SELECT = {
  id: true,
  publicRef: true,
  status: true,
  clientType: true,
  city: true,
  departmentCode: true,
  startDate: true,
  endDate: true,
  flexibleDates: true,
  urgent: true,
  wasteTypes: true,
  volumeM3: true,
  placement: true,
  accessFlags: true,
  contactPreference: true,
  publishedAt: true,
  maxUnlocks: true,
  unlockCount: true,
  _count: { select: { photos: true } },
} satisfies Prisma.RequestSelect;

type PreviewRow = Prisma.RequestGetPayload<{ select: typeof PREVIEW_SELECT }>;

export type RequestPreview = {
  id: string;
  publicRef: string;
  status: string;
  clientType: string;
  city: string;
  departmentCode: string;
  departmentName: string;
  startDate: string;
  endDate: string | null;
  flexibleDates: boolean;
  urgent: boolean;
  wasteTypes: string[];
  volumeM3: number | null;
  placement: string;
  accessFlags: string[];
  contactChannels: string;
  publishedAt: string | null;
  placesLeft: number;
  maxPlaces: number;
  hasPhotos: boolean;
  available: boolean;
};

export function toPreview(r: PreviewRow): RequestPreview {
  const placesLeft = Math.max(0, r.maxUnlocks - r.unlockCount);
  return {
    id: r.id,
    publicRef: r.publicRef,
    status: r.status,
    clientType: r.clientType,
    city: r.city,
    departmentCode: r.departmentCode,
    departmentName: departmentName(r.departmentCode),
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate ? r.endDate.toISOString().slice(0, 10) : null,
    flexibleDates: r.flexibleDates,
    urgent: r.urgent,
    wasteTypes: r.wasteTypes,
    volumeM3: r.volumeM3,
    placement: r.placement,
    accessFlags: r.accessFlags,
    contactChannels: r.contactPreference,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    placesLeft,
    maxPlaces: r.maxUnlocks,
    hasPhotos: r._count.photos > 0,
    available: r.status === "PUBLISHED" && placesLeft > 0,
  };
}

/** Demandes adressées à une entreprise (aperçu uniquement, sans données privées). */
export async function listPreviewsForCompany(companyId: string, opts: { onlyOpen?: boolean } = {}) {
  const rows = await prisma.request.findMany({
    where: {
      recipients: { some: { companyId, notifiedAt: { not: null } } },
      ...(opts.onlyOpen ? { status: "PUBLISHED" } : { status: { not: "DRAFT" } }),
    },
    select: { ...PREVIEW_SELECT, unlocks: { where: { companyId }, select: { id: true } } },
    orderBy: { publishedAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({ ...toPreview(r), unlockedByMe: r.unlocks.length > 0 }));
}

export async function getPreviewForCompany(requestId: string, companyId: string) {
  const r = await prisma.request.findFirst({
    where: { id: requestId, status: { not: "DRAFT" }, recipients: { some: { companyId, notifiedAt: { not: null } } } },
    select: PREVIEW_SELECT,
  });
  return r ? toPreview(r) : null;
}

/**
 * Données complètes : uniquement si un déblocage valide existe pour CETTE entreprise.
 * Seuls les canaux choisis ET vérifiés par le client sont renvoyés.
 */
export async function getUnlockedDetails(requestId: string, companyId: string) {
  const unlock = await prisma.unlock.findUnique({ where: { requestId_companyId: { requestId, companyId } } });
  if (!unlock) return null;
  if (unlock.accessExpiresAt && unlock.accessExpiresAt < new Date()) return { expired: true as const, unlockedAt: unlock.createdAt };
  const r = await prisma.request.findUnique({
    where: { id: requestId },
    include: { photos: true, permit: { select: { status: true, lengthM: true, widthM: true } } },
  });
  if (!r) return null;
  const wantsPhone = r.contactPreference !== "EMAIL";
  const wantsEmail = r.contactPreference !== "PHONE";
  return {
    expired: false as const,
    unlockId: unlock.id,
    unlockedAt: unlock.createdAt,
    preview: toPreview({ ...r, _count: { photos: r.photos.length } }),
    contactName: r.contactName,
    companyName: r.clientType === "PROFESSIONAL" ? r.companyName : null,
    phone: wantsPhone && r.phoneVerifiedAt ? r.phone : null,
    email: wantsEmail && r.emailVerifiedAt ? r.email : null,
    callbackHours: r.callbackHours,
    addressLine: r.addressLine,
    addressComplement: r.addressComplement,
    postalCode: r.postalCode,
    city: r.city,
    accessDetails: r.accessDetails,
    wasteNotes: r.wasteNotes,
    photos: r.photos.map((p) => ({ id: p.id, url: signedFileUrl(p.storageKey), mime: p.mimeType })),
    permitStatus: r.permit?.status ?? null,
    closedStatus: ["CLOSED", "CANCELLED", "FULFILLED"].includes(r.status) ? r.status : null,
  };
}
