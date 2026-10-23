import { z } from "zod";
import { WASTE_TYPES, ACCESS_FLAGS } from "../catalog";
import { departmentFromPostalCode } from "../geo";

const wasteCodes = WASTE_TYPES.map((w) => w.code) as [string, ...string[]];
const accessCodes = ACCESS_FLAGS.map((a) => a.code) as [string, ...string[]];

export const CALLBACK_SLOTS = [
  { code: "MORNING", label: "Matin (8 h – 12 h)" },
  { code: "LUNCH", label: "Midi (12 h – 14 h)" },
  { code: "AFTERNOON", label: "Après-midi (14 h – 18 h)" },
  { code: "EVENING", label: "Fin de journée (18 h – 20 h)" },
  { code: "SATURDAY", label: "Samedi" },
];
const callbackCodes = CALLBACK_SLOTS.map((c) => c.code) as [string, ...string[]];

const phoneRe = /^(?:\+33\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/;
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");

export const createRequestSchema = z
  .object({
    clientType: z.enum(["INDIVIDUAL", "PROFESSIONAL"]),
    companyName: z.string().trim().max(120).optional().nullable(),
    addressLine: z.string().trim().min(3, "Adresse requise").max(200),
    addressComplement: z.string().trim().max(200).optional().nullable(),
    postalCode: z.string().trim().regex(/^\d{5}$/, "Code postal invalide"),
    city: z.string().trim().min(1, "Commune requise").max(100),
    startDate: isoDate,
    endDate: isoDate.optional().nullable(),
    flexibleDates: z.boolean().default(false),
    urgent: z.boolean().default(false),
    wasteTypes: z.array(z.enum(wasteCodes)).min(1, "Choisissez au moins un type de déchets").max(5),
    wasteNotes: z.string().trim().max(500).optional().nullable(),
    volumeM3: z.number().int().min(1).max(40).nullable(),
    placement: z.enum(["PRIVATE", "PUBLIC_ROAD", "UNKNOWN"]),
    accessFlags: z.array(z.enum(accessCodes)).max(10).default([]),
    accessDetails: z.string().trim().max(500).optional().nullable(),
    contactPreference: z.enum(["PHONE", "EMAIL", "BOTH"]),
    contactName: z.string().trim().min(2, "Nom requis").max(100),
    email: z.string().trim().toLowerCase().email("Email invalide").max(200).optional().nullable(),
    phone: z.string().trim().regex(phoneRe, "Téléphone invalide").optional().nullable(),
    callbackSlots: z.array(z.enum(callbackCodes)).max(5).default([]),
    // anti-spam
    website: z.string().max(0).optional(), // champ piège : doit rester vide
    startedAt: z.number().optional(),
    captchaToken: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (!departmentFromPostalCode(v.postalCode)) ctx.addIssue({ code: "custom", path: ["postalCode"], message: "Code postal non reconnu" });
    if ((v.contactPreference === "EMAIL" || v.contactPreference === "BOTH") && !v.email)
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email requis pour ce mode de contact" });
    if ((v.contactPreference === "PHONE" || v.contactPreference === "BOTH") && !v.phone)
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Téléphone requis pour ce mode de contact" });
    const today = new Date().toISOString().slice(0, 10);
    if (v.startDate < today) ctx.addIssue({ code: "custom", path: ["startDate"], message: "La date de pose doit être future" });
    if (v.endDate && v.endDate < v.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Le retrait doit suivre la pose" });
    if (v.clientType === "PROFESSIONAL" && !v.companyName)
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Raison sociale requise" });
  });

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

// Texte du consentement de contact, conservé avec la demande (preuve).
export const CONTACT_CONSENT_VERSION = "2026-10-v1";
export function contactConsentText(channels: string, max: number) {
  return `[${CONTACT_CONSENT_VERSION}] Je demande à être contacté(e) par ${channels} au sujet de cette demande de location de benne par ${max} entreprises au maximum parmi les destinataires présentés. Cette demande n'autorise aucune prospection publicitaire.`;
}

export function channelsLabel(pref: "PHONE" | "EMAIL" | "BOTH") {
  return pref === "PHONE" ? "téléphone" : pref === "EMAIL" ? "email" : "téléphone et email";
}
