import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { hmac, randomToken, safeEqual } from "./crypto";
import { AppError } from "./errors";

// Stockage privé : disque local (hors du dossier public) ou Netlify Blobs quand
// STORAGE_DRIVER=netlify-blobs (hébergement serverless sans disque persistant).
// Dans les deux cas, les fichiers ne sont servis que via /api/files/<clé> avec une
// signature HMAC à durée limitée, émise uniquement après un contrôle de droits côté serveur.

const ROOT = () => path.resolve(process.env.STORAGE_DIR || "./storage");
const blobsEnabled = () => process.env.STORAGE_DRIVER === "netlify-blobs";

async function blobStore() {
  const { getStore } = await import("@netlify/blobs");
  // Région fixée à chaque appel (sinon us-east-2 par défaut) ; cohérence forte pour relire juste après l'envoi.
  return getStore({ name: "private-files", region: "eu-central-1", consistency: "strong" });
}
export const MAX_FILE_BYTES = 8 * 1024 * 1024;

const SIGNATURES: { mime: string; ext: string; test: (b: Buffer) => boolean }[] = [
  { mime: "image/jpeg", ext: "jpg", test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/png", ext: "png", test: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/webp", ext: "webp", test: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", test: (b) => b.subarray(0, 5).toString() === "%PDF-" },
];

/** Détermine le type réel à partir du contenu (le type annoncé par le navigateur est ignoré). */
export function sniffMime(buf: Buffer, allowed: string[]): { mime: string; ext: string } {
  const hit = SIGNATURES.find((s) => s.test(buf));
  if (!hit || !allowed.includes(hit.mime)) throw new AppError("INVALID_FILE", "Format de fichier non accepté");
  return hit;
}

export async function saveFile(buf: Buffer, folder: string, allowed: string[]) {
  if (buf.length === 0 || buf.length > MAX_FILE_BYTES) throw new AppError("INVALID_FILE", "Fichier vide ou trop volumineux (8 Mo max)");
  const { mime, ext } = sniffMime(buf, allowed);
  const key = `${folder}/${randomToken(18)}.${ext}`;
  if (blobsEnabled()) {
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
    await (await blobStore()).set(key, ab, { metadata: { mime } });
    return { key, mime, size: buf.length };
  }
  const full = path.join(ROOT(), key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, buf, { mode: 0o600 });
  return { key, mime, size: buf.length };
}

function resolveKey(key: string) {
  if (!/^[a-z0-9_-]+\/[A-Za-z0-9_-]+\.(jpg|png|webp|pdf)$/.test(key)) throw new AppError("INVALID_KEY", "Clé invalide", 400);
  return path.join(ROOT(), key);
}

export async function readStoredFile(key: string): Promise<Buffer> {
  const full = resolveKey(key);
  if (blobsEnabled()) {
    const data = await (await blobStore()).get(key, { type: "arrayBuffer" });
    if (data === null) throw new AppError("NOT_FOUND", "Fichier introuvable", 404);
    return Buffer.from(data);
  }
  return readFile(full);
}

export async function deleteStoredFile(key: string) {
  const full = resolveKey(key);
  if (blobsEnabled()) {
    await (await blobStore()).delete(key).catch(() => {});
    return;
  }
  await unlink(full).catch(() => {});
}

export function signedFileUrl(key: string, ttlSeconds = 600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = hmac(`file:${key}:${exp}`);
  return `/api/files/${key}?exp=${exp}&sig=${sig}`;
}

export function verifyFileSignature(key: string, exp: string | null, sig: string | null) {
  if (!exp || !sig) return false;
  const e = Number(exp);
  if (!Number.isFinite(e) || e < Date.now() / 1000) return false;
  return safeEqual(hmac(`file:${key}:${e}`), sig);
}

export function mimeFromKey(key: string) {
  const ext = key.split(".").pop();
  return SIGNATURES.find((s) => s.ext === ext)?.mime ?? "application/octet-stream";
}
