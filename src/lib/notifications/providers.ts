import nodemailer from "nodemailer";
import webpush from "web-push";
import { emailConfigured, pushConfigured, smsConfigured } from "../integrations";

export class NotConfiguredError extends Error {
  constructor(channel: string) {
    super(`${channel} non configuré`);
  }
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

export async function sendEmail(to: string, subject: string, text: string, html?: string, attachments?: { filename: string; content: Buffer }[]) {
  if (!emailConfigured()) throw new NotConfiguredError("Email");
  transporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  const info = await transporter.sendMail({ from: process.env.SMTP_FROM, to, subject, text, html, attachments });
  return { providerId: info.messageId };
}

/** SMS via l'API REST Twilio (sans SDK). Autres fournisseurs : ajouter une branche ici. */
export async function sendSms(to: string, body: string) {
  if (!smsConfigured()) throw new NotConfiguredError("SMS");
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: process.env.TWILIO_FROM!, Body: body.slice(0, 600) }),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { sid?: string };
  return { providerId: json.sid };
}

export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, payload: object) {
  if (!pushConfigured()) throw new NotConfiguredError("Push");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
    TTL: 3600,
  });
}

/** Normalise un numéro français en E.164 (+33...). */
export function toE164(phone: string): string | null {
  const digits = phone.replace(/[^\d+]/g, "");
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  if (/^0[1-9]\d{8}$/.test(digits)) return "+33" + digits.slice(1);
  if (/^0033[1-9]\d{8}$/.test(digits)) return "+" + digits.slice(2);
  return null;
}
