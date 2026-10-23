import type { PermitStatus } from "@prisma/client";
import { z } from "zod";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "./db";
import { AppError, notFound } from "./errors";
import { readStoredFile } from "./storage";
import { emailConfigured } from "./integrations";
import { sendEmail } from "./notifications/providers";
import { BRAND_NAME } from "./brand";
import { departmentName } from "./geo";
import { audit } from "./audit";

// Assistant d'autorisation de voirie (permis de stationnement / occupation du domaine public).
// La plateforme n'est PAS un service administratif : elle aide à préparer un dossier.
// Il n'existe pas d'API nationale des mairies : l'annuaire est saisi et vérifié par l'administration.

export const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  TO_PREPARE: "À préparer",
  READY: "Prêt",
  SENT_BY_USER: "Envoyé par vous",
  RECEIPT_CONFIRMED: "Réception confirmée par l'autorité",
  INFO_REQUESTED: "Complément demandé",
  GRANTED: "Autorisation accordée",
  REFUSED: "Refusée",
};

// Statuts que le demandeur peut déclarer après l'envoi, sur la base de la réponse de l'autorité.
const USER_DECLARABLE: Record<PermitStatus, PermitStatus[]> = {
  TO_PREPARE: [],
  READY: ["SENT_BY_USER"],
  SENT_BY_USER: ["RECEIPT_CONFIRMED", "INFO_REQUESTED", "GRANTED", "REFUSED"],
  RECEIPT_CONFIRMED: ["INFO_REQUESTED", "GRANTED", "REFUSED"],
  INFO_REQUESTED: ["SENT_BY_USER", "GRANTED", "REFUSED"],
  GRANTED: [],
  REFUSED: ["TO_PREPARE"],
};

/**
 * Modèles de formulaires officiels connus, pour le préremplissage.
 * Volontairement vide : un modèle ne doit être ajouté qu'après vérification du
 * formulaire officiel de la collectivité (clé = PermitAuthority.knownFormTemplate).
 */
export const KNOWN_FORM_TEMPLATES: Record<string, { label: string; build: (p: PermitData) => Record<string, string> }> = {};

type PermitData = Awaited<ReturnType<typeof loadPermit>>;

async function loadPermit(requestId: string) {
  const p = await prisma.permit.findUnique({
    where: { requestId },
    include: { request: true, authority: true, files: true, events: { orderBy: { createdAt: "asc" } } },
  });
  if (!p) throw notFound("Dossier");
  return p;
}

export async function findAuthorities(postalCode: string, departmentCode: string) {
  const exact = await prisma.permitAuthority.findMany({ where: { active: true, postalCodes: { has: postalCode } }, orderBy: { name: "asc" } });
  const dept = await prisma.permitAuthority.findMany({ where: { active: true, departmentCode, postalCodes: { isEmpty: true } }, orderBy: { name: "asc" } });
  return { exact, dept };
}

export const permitUpdateSchema = z.object({
  locationDetails: z.string().trim().max(1000).optional().nullable(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  lengthM: z.number().min(0.5).max(20).optional().nullable(),
  widthM: z.number().min(0.5).max(10).optional().nullable(),
  heightM: z.number().min(0.2).max(6).optional().nullable(),
  dimensionsConfirmed: z.boolean().optional(),
  applicantName: z.string().trim().max(150).optional().nullable(),
  applicantQuality: z.string().trim().max(150).optional().nullable(),
  authorityId: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export async function updatePermit(requestId: string, raw: unknown) {
  const d = permitUpdateSchema.parse(raw);
  const p = await loadPermit(requestId);
  if (["GRANTED", "REFUSED"].includes(p.status)) throw new AppError("PERMIT_LOCKED", "Dossier clôturé");
  if (d.authorityId) await prisma.permitAuthority.findUniqueOrThrow({ where: { id: d.authorityId } });
  const updated = await prisma.permit.update({
    where: { id: p.id },
    data: {
      locationDetails: d.locationDetails ?? undefined,
      startDate: d.startDate ? new Date(`${d.startDate}T00:00:00Z`) : undefined,
      endDate: d.endDate ? new Date(`${d.endDate}T00:00:00Z`) : undefined,
      lengthM: d.lengthM ?? undefined,
      widthM: d.widthM ?? undefined,
      heightM: d.heightM ?? undefined,
      dimensionsConfirmed: d.dimensionsConfirmed ?? undefined,
      applicantName: d.applicantName ?? undefined,
      applicantQuality: d.applicantQuality ?? undefined,
      authorityId: d.authorityId ?? undefined,
      notes: d.notes ?? undefined,
    },
  });
  // Passage automatique à « Prêt » quand les informations essentielles sont présentes.
  const ready = Boolean(updated.locationDetails && updated.startDate && updated.endDate && updated.lengthM && updated.widthM && updated.authorityId);
  if (ready && updated.status === "TO_PREPARE") await setPermitStatus(requestId, "READY", "Informations complètes", true);
  if (!ready && updated.status === "READY") await setPermitStatus(requestId, "TO_PREPARE", "Informations incomplètes", true);
  return prisma.permit.findUniqueOrThrow({ where: { id: p.id } });
}

export async function setPermitStatus(requestId: string, status: PermitStatus, note?: string, system = false) {
  const p = await loadPermit(requestId);
  if (!system && !USER_DECLARABLE[p.status].includes(status)) throw new AppError("INVALID_TRANSITION", `Passage de « ${PERMIT_STATUS_LABELS[p.status]} » à « ${PERMIT_STATUS_LABELS[status]} » impossible`);
  if (status === "GRANTED" && !p.files.some((f) => f.kind === "AUTHORIZATION"))
    throw new AppError("AUTHORIZATION_FILE_REQUIRED", "Téléversez l'autorisation reçue de l'autorité avant d'indiquer qu'elle est accordée");
  await prisma.$transaction([
    prisma.permit.update({
      where: { id: p.id },
      data: { status, ...(status === "SENT_BY_USER" && !p.sentAt ? { sentAt: new Date(), sentVia: p.sentVia ?? "USER_DOWNLOAD" } : {}), ...(status === "GRANTED" || status === "REFUSED" ? { decisionAt: new Date() } : {}) },
    }),
    prisma.permitEvent.create({ data: { permitId: p.id, status, note: note?.slice(0, 500) } }),
  ]);
}

/** Envoi depuis l'application : uniquement vers un canal de dépôt vérifié, après validation explicite. */
export async function sendPermitFromApp(requestId: string, confirmed: boolean) {
  if (!confirmed) throw new AppError("CONFIRMATION_REQUIRED", "Confirmez l'envoi du dossier");
  const p = await loadPermit(requestId);
  if (p.status !== "READY" && p.status !== "INFO_REQUESTED") throw new AppError("NOT_READY", "Le dossier n'est pas prêt");
  const a = p.authority;
  if (!a?.submissionEmail || !a.submissionEmailVerified) throw new AppError("NO_VERIFIED_CHANNEL", "Aucun canal de dépôt vérifié pour cette autorité : téléchargez le dossier et suivez les instructions.");
  if (!emailConfigured()) throw new AppError("EMAIL_NOT_CONFIGURED", "L'envoi d'emails n'est pas configuré : téléchargez le dossier.", 503);
  const pdf = await permitPdf(requestId);
  const replyTo = p.request.email;
  await sendEmail(
    a.submissionEmail,
    `Demande d'autorisation d'occupation du domaine public — benne — ${p.request.city}`,
    `Bonjour,\n\nVeuillez trouver ci-joint une demande d'autorisation pour la pose d'une benne, préparée par ${p.applicantName ?? p.request.contactName}${replyTo ? ` (réponse à : ${replyTo})` : ""}.\n\nCe dossier a été préparé avec l'outil ${BRAND_NAME}, qui n'est pas un service administratif.\n\nCordialement`,
    undefined,
    [{ filename: `dossier-voirie-${p.request.publicRef}.pdf`, content: pdf }],
  );
  await prisma.permit.update({ where: { id: p.id }, data: { sentVia: "EMAIL_FROM_APP", sendConfirmedByUserAt: new Date() } });
  await setPermitStatus(requestId, "SENT_BY_USER", `Envoyé depuis l'application à ${a.submissionEmail}`, true);
  await audit({ actorType: "CLIENT", action: "PERMIT_SENT_FROM_APP", entityType: "Permit", entityId: p.id, data: { to: a.submissionEmail } });
}

const clean = (s: string) => s.replace(/[  ]/g, " ").replace(/[^\x20-\x7E -ÿ€’œŒ–—…]/g, "");

export async function permitPdf(requestId: string) {
  const p = await loadPermit(requestId);
  const r = p.request;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 800;
  const line = (t: string, size = 10, f = font) => {
    for (const chunk of clean(t).match(/.{1,95}(\s|$)|.{1,95}/g) ?? [""]) {
      if (y < 60) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(chunk.trim(), { x: 40, y, size, font: f, color: rgb(0.1, 0.12, 0.15) });
      y -= size + 4;
    }
  };
  line("Dossier récapitulatif — Demande d'autorisation de pose de benne sur la voie publique", 13, bold);
  y -= 4;
  line(`Document préparé avec ${BRAND_NAME}. Ce document n'est pas une autorisation et ${BRAND_NAME} n'est pas un service administratif.`, 9);
  line("Des frais (redevance d'occupation du domaine public) et des délais d'instruction peuvent s'appliquer selon la collectivité.", 9);
  y -= 10;
  line("Demandeur", 11, bold);
  line(`Nom : ${p.applicantName ?? r.contactName}${p.applicantQuality ? ` (${p.applicantQuality})` : ""}`);
  if (r.email) line(`Email : ${r.email}`);
  if (r.phone) line(`Téléphone : ${r.phone}`);
  y -= 6;
  line("Emplacement", 11, bold);
  line(`Adresse : ${r.addressLine}${r.addressComplement ? `, ${r.addressComplement}` : ""}, ${r.postalCode} ${r.city} (${departmentName(r.departmentCode)})`);
  if (p.locationDetails) line(`Précisions : ${p.locationDetails}`);
  y -= 6;
  line("Occupation", 11, bold);
  line(`Du ${p.startDate?.toLocaleDateString("fr-FR") ?? "à préciser"} au ${p.endDate?.toLocaleDateString("fr-FR") ?? "à préciser"}`);
  line(`Dimensions au sol : ${p.lengthM ?? "?"} m x ${p.widthM ?? "?"} m${p.heightM ? `, hauteur ${p.heightM} m` : ""} ${p.dimensionsConfirmed ? "(confirmées par le loueur)" : "(estimées, à confirmer avec le loueur)"}`);
  line(`Volume envisagé : ${r.volumeM3 ? `${r.volumeM3} m³` : "à préciser"}`);
  y -= 6;
  line("Autorité destinataire", 11, bold);
  if (p.authority) {
    line(`${p.authority.name}`);
    if (p.authority.portalUrl) line(`Portail : ${p.authority.portalUrl}`);
    if (p.authority.email) line(`Email : ${p.authority.email}`);
    if (p.authority.lastVerifiedAt) line(`Informations vérifiées le ${p.authority.lastVerifiedAt.toLocaleDateString("fr-FR")}`, 8);
  } else line("Non identifiée : renseignez-vous auprès de la mairie de la commune.");
  if (p.notes) {
    y -= 6;
    line("Remarques", 11, bold);
    line(p.notes);
  }
  for (const f of p.files.filter((f) => f.kind === "PLAN" || f.kind === "PHOTO")) {
    if (f.mimeType !== "image/jpeg" && f.mimeType !== "image/png") continue;
    const bytes = await readStoredFile(f.storageKey).catch(() => null);
    if (!bytes) continue;
    const img = f.mimeType === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
    const pg = pdf.addPage([595, 842]);
    const scale = Math.min(515 / img.width, 700 / img.height, 1);
    pg.drawText(f.kind === "PLAN" ? "Plan d'implantation" : "Photo de l'emplacement", { x: 40, y: 800, size: 12, font: bold });
    pg.drawImage(img, { x: 40, y: 780 - img.height * scale, width: img.width * scale, height: img.height * scale });
  }
  return Buffer.from(await pdf.save());
}

export function prefillOfficialForm(p: PermitData) {
  const key = p.authority?.knownFormTemplate;
  if (!key || !KNOWN_FORM_TEMPLATES[key]) return null;
  return KNOWN_FORM_TEMPLATES[key].build(p);
}

export { loadPermit };
