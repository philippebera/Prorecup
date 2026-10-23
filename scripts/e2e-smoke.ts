/* Test de bout en bout par HTTP contre un serveur en cours d'exécution (next dev).
 *
 *   STRIPE_SECRET_KEY=sk_test_dummy STRIPE_WEBHOOK_SECRET=whsec_e2e_local_secret \
 *     npx next dev -p 3100 > dev.log 2>&1 &
 *   E2E_BASE=http://localhost:3100 E2E_LOG=dev.log E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... \
 *     npx tsx --env-file=.env scripts/e2e-smoke.ts
 *
 * Vérifie notamment qu'AUCUNE réponse HTTP (HTML ou JSON) reçue par un loueur
 * ne contient les coordonnées ou l'adresse exacte avant déblocage.
 * Les codes de vérification sont lus dans le journal du serveur de développement
 * (DEV_LOG_OTP=true) : aucun email ni SMS n'est réellement envoyé.
 */
import { readFileSync } from "node:fs";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.E2E_BASE || "http://localhost:3100";
const LOG = process.env.E2E_LOG!;
const WHSEC = process.env.E2E_WHSEC || "whsec_e2e_local_secret";
const prisma = new PrismaClient();

class Jar {
  cookies = new Map<string, string>();
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  store(res: Response) {
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const [k, ...v] = kv.split("=");
      this.cookies.set(k.trim(), v.join("="));
    }
  }
}

async function call(jar: Jar, method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
  const res = await fetch(BASE + path, {
    method,
    redirect: "manual",
    headers: { Origin: BASE, Cookie: jar.header(), ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...extra },
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
  jar.store(res);
  const text = await res.text();
  return { status: res.status, text, json: (() => { try { return JSON.parse(text); } catch { return null; } })() };
}

let failures = 0;
function check(label: string, cond: boolean, extra?: unknown) {
  console.log(`${cond ? "✔" : "✘"} ${label}`);
  if (!cond) {
    failures++;
    if (extra !== undefined) console.log("   →", typeof extra === "string" ? extra.slice(0, 400) : extra);
  }
}

async function otpFromLog(ref: string, channel: string) {
  for (let i = 0; i < 20; i++) {
    const lines = readFileSync(LOG, "utf8").split("\n").filter((l) => l.includes(`Code ${channel} pour ${ref}`));
    const m = lines.at(-1)?.match(/(\d{6})\s*$/);
    if (m) return m[1];
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Code ${channel} introuvable dans le journal`);
}

async function main() {
  const run = Date.now().toString(36);
  const email = `client.${run}@e2e.test`;
  const phone = "0699887766";
  const street = `${run} rue Confidentielle`;
  const name = `Client Secret ${run}`;
  const access = `Digicode ${run}`;
  const start = new Date(Date.now() + 10 * 86400_000).toISOString().slice(0, 10);

  // --- Pages publiques -----------------------------------------------------
  const anon = new Jar();
  const home = await call(anon, "GET", "/");
  check("Accueil rendu côté serveur avec le bouton principal", home.status === 200 && home.text.includes("Recevoir des propositions"));
  const robots = await call(anon, "GET", "/robots.txt");
  check("robots.txt exclut les espaces privés", robots.text.includes("Disallow: /suivi") && robots.text.includes("Disallow: /api/"));
  const sitemap = await call(anon, "GET", "/sitemap.xml");
  check("sitemap.xml sans URL privée", sitemap.status === 200 && !sitemap.text.includes("/suivi") && !sitemap.text.includes("/loueur/"));
  const guide = await call(anon, "GET", "/guides/choisir-volume-benne");
  check("Guide indexable avec URL canonique", guide.text.includes('rel="canonical"'));
  const privateHead = await fetch(`${BASE}/suivi`);
  check("Espace de suivi marqué noindex", (privateHead.headers.get("x-robots-tag") ?? "").includes("noindex"));

  // --- Loueur : inscription + validation admin ----------------------------
  const siretBase = String(Math.floor(Math.random() * 9e12)).padStart(13, "1");
  let siret = "";
  for (let d = 0; d <= 9; d++) {
    const s = siretBase + d;
    let sum = 0;
    for (let i = 0; i < 14; i++) { let x = Number(s[13 - i]); if (i % 2) { x *= 2; if (x > 9) x -= 9; } sum += x; }
    if (sum % 10 === 0) { siret = s; break; }
  }
  const loueur = new Jar();
  const reg = await call(loueur, "POST", "/api/loueur/register", {
    legalName: `E2E Bennes ${run}`, siret, email: `contact@e2e-${run}.test`, phone: "0478000000", addressLine: "1 quai du Test", postalCode: "38000", city: "Grenoble",
    skipSizesM3: [8, 10], wasteTypes: ["GRAVATS", "DIB"], services: ["PUBLIC_ROAD"], departments: ["38"], postalCodes: [],
    ownerName: "Loueur E2E", ownerEmail: `owner@e2e-${run}.test`, password: "motdepasse-e2e-123", acceptTerms: true, publicProfile: true,
  });
  check("Inscription loueur", reg.status === 200, reg.text);
  const company = await prisma.company.findUniqueOrThrow({ where: { siret } });

  const pendingUnlockList = await call(loueur, "GET", "/loueur");
  check("Loueur non validé : bandeau de validation", pendingUnlockList.text.includes("en cours de validation"));

  const admin = new Jar();
  const login = await call(admin, "POST", "/api/auth/login", { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD });
  check("Connexion administrateur", login.status === 200, login.text);
  const approve = await call(admin, "POST", `/api/admin/companies/${company.id}`, { action: "approve", grantWelcome: true });
  check("Validation : 3 crédits de découverte", approve.json?.granted === 3, approve.text);
  const approve2 = await call(admin, "POST", `/api/admin/companies/${company.id}`, { action: "approve", grantWelcome: true });
  check("Seconde validation : aucun crédit supplémentaire", approve2.json?.granted === 0, approve2.text);
  const forbiddenAdmin = await call(loueur, "POST", `/api/admin/companies/${company.id}`, { action: "approve" });
  check("Un loueur ne peut pas appeler l'API admin", forbiddenAdmin.status === 403);

  // --- Client : demande + vérification -------------------------------------
  const client = new Jar();
  const bad = await call(client, "POST", "/api/requests", { clientType: "INDIVIDUAL" });
  check("Validation serveur des champs", bad.status === 422);
  const created = await call(client, "POST", "/api/requests", {
    clientType: "INDIVIDUAL", addressLine: street, postalCode: "38000", city: "Grenoble", startDate: start, endDate: null, flexibleDates: true, urgent: false,
    wasteTypes: ["GRAVATS"], wasteNotes: `Mon portable ${phone}`, volumeM3: 8, placement: "PUBLIC_ROAD", accessFlags: ["NARROW_STREET"], accessDetails: access,
    contactPreference: "BOTH", contactName: name, email, phone, callbackSlots: ["MORNING"], startedAt: Date.now() - 60_000,
  });
  check("Dépôt de la demande (brouillon)", created.status === 200, created.text);
  const { id, publicRef } = created.json;
  const early = await call(client, "POST", `/api/requests/${id}/recipients`, {});
  check("Destinataires refusés avant vérification", early.status === 400 && early.json?.error === "NOT_VERIFIED");
  for (const channel of ["EMAIL", "PHONE"]) {
    const s = await call(client, "POST", `/api/requests/${id}/send-code`, { channel });
    check(`Code ${channel} émis (console de dev, aucun envoi réel)`, s.json?.delivery === "dev-console", s.text);
    const wrong = await call(client, "POST", `/api/requests/${id}/verify`, { channel, code: "000000" });
    check(`Code ${channel} incorrect refusé`, wrong.status === 400);
    const v = await call(client, "POST", `/api/requests/${id}/verify`, { channel, code: await otpFromLog(publicRef, channel) });
    check(`${channel} vérifié`, v.status === 200, v.text);
  }
  const rec = await call(client, "POST", `/api/requests/${id}/recipients`, {});
  check("Destinataires présentés avant diffusion (loueur réel, pas de démo)", rec.json?.recipients?.length === 1 && rec.json.recipients[0].id === company.id, rec.text);
  const noConsent = await call(client, "POST", `/api/requests/${id}/publish`, { contactConsent: false });
  check("Diffusion refusée sans consentement", noConsent.status === 400);
  const pub = await call(client, "POST", `/api/requests/${id}/publish`, { contactConsent: true, marketingConsent: false });
  check("Demande diffusée", pub.status === 200 && pub.json?.recipients === 1, pub.text);
  const otherClient = new Jar();
  const intrus = await call(otherClient, "POST", `/api/requests/${id}/status`, { action: "close" });
  check("Un tiers sans lien de suivi ne peut pas agir sur la demande", intrus.status === 403);

  // --- Confidentialité des réponses réseau avant déblocage -------------------
  const secrets = [email, phone, "+33699887766", "06 99 88 77 66", street, name, access, "Mon portable"];
  const leaks = (t: string) => secrets.filter((s) => t.includes(s));
  const pages = [
    await call(loueur, "GET", "/loueur"),
    await call(loueur, "GET", "/loueur/demandes"),
    await call(loueur, "GET", `/loueur/demandes/${id}`),
    await call(loueur, "GET", "/notifications"),
    await call(loueur, "GET", `/loueur/demandes/${id}?_rsc=1`, undefined, { RSC: "1" }),
  ];
  check("Aperçu de la demande visible par le loueur destinataire", pages[2].status === 200 && pages[2].text.includes(publicRef) && pages[2].text.includes("Grenoble"));
  pages.forEach((p, i) => check(`Réponse loueur n°${i + 1} sans coordonnées ni adresse exacte`, p.status === 200 && leaks(p.text).length === 0, leaks(p.text)));
  const notifs = await prisma.notification.findMany({ where: { companyId: company.id, kind: "NEW_REQUEST" } });
  check("Notification de nouvelle demande créée et sans données privées", notifs.length > 0 && notifs.every((n) => leaks(n.title + n.body).length === 0));
  check("Email au loueur non configuré : non marqué envoyé", notifs.filter((n) => n.channel === "EMAIL").every((n) => n.status === "SKIPPED_NOT_CONFIGURED"));

  // --- Déblocage ------------------------------------------------------------
  const noConfirm = await call(loueur, "POST", `/api/loueur/requests/${id}/unlock`, { confirmed: false });
  check("Déblocage sans confirmation refusé, message d'avertissement exact", noConfirm.status === 400 && noConfirm.json?.message?.includes("deux autres entreprises maximum"));
  const unlock = await call(loueur, "POST", `/api/loueur/requests/${id}/unlock`, { confirmed: true });
  check("Déblocage : 1 crédit débité", unlock.json?.status === "UNLOCKED" && unlock.json?.balance === 2, unlock.text);
  const again = await call(loueur, "POST", `/api/loueur/requests/${id}/unlock`, { confirmed: true });
  check("Second déblocage : aucun débit", again.json?.status === "ALREADY_UNLOCKED");
  const after = await call(loueur, "GET", `/loueur/demandes/${id}`);
  check("Après déblocage : téléphone, email et adresse visibles", after.text.includes("+33699887766") && after.text.includes(email) && after.text.includes(street));
  check("Boutons Appeler / Envoyer un email / Envoyer une offre", after.text.includes("Appeler") && after.text.includes("Envoyer un email") && after.text.includes("Envoyer une offre"));

  // --- Offre ----------------------------------------------------------------
  const offer = await call(loueur, "POST", `/api/loueur/requests/${id}/offers`, {
    volumeM3: 8, wasteAllowed: "Gravats inertes", wasteExcluded: "Plâtre, amiante", includesDelivery: true, includesTransport: true, includesPickup: true,
    includedDays: 7, weightMode: "INCLUDED", includedTonnes: 2, pricePerTonneCents: 6000, pricePerExtraDayCents: 1500, otherFees: null,
    amountHtCents: 25000, vatRateBp: 2000, proposedAvailability: "Dès la date souhaitée", validUntil: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
  });
  check("Offre envoyée", offer.status === 200, offer.text);
  const suivi = await call(client, "GET", `/suivi/${id}`);
  check("Le client voit l'entreprise et l'offre (300,00 € TTC)", suivi.text.includes(`E2E Bennes ${run}`) && suivi.text.includes("300,00"));

  // --- Voirie ---------------------------------------------------------------
  const permit = await call(client, "PUT", `/api/requests/${id}/permit`, { locationDetails: "Devant le portail", startDate: start, endDate: start, lengthM: 4, widthM: 2 });
  check("Dossier voirie enregistré (à préparer, autorité non identifiée)", permit.json?.status === "TO_PREPARE", permit.text);
  const pdf = await fetch(`${BASE}/api/requests/${id}/permit/pdf`, { headers: { Cookie: client.header() } });
  check("PDF récapitulatif généré", pdf.status === 200 && pdf.headers.get("content-type") === "application/pdf");
  const grant = await call(client, "POST", `/api/requests/${id}/permit/status`, { status: "GRANTED" });
  check("Impossible de déclarer « accordée » depuis « à préparer »", grant.status === 400);

  // --- Clôture --------------------------------------------------------------
  const close = await call(client, "POST", `/api/requests/${id}/status`, { action: "fulfilled", chosenCompanyId: company.id });
  check("Client : « j'ai trouvé un loueur »", close.json?.status === "FULFILLED", close.text);

  // --- Stripe ---------------------------------------------------------------
  const pack = await prisma.creditPack.findUniqueOrThrow({ where: { code: "PACK_5" } });
  const forged = await call(loueur, "POST", "/api/loueur/checkout", { packId: pack.id, priceHtCents: 1 });
  check("Checkout : un prix envoyé par le navigateur est rejeté", forged.status === 422);
  const purchase = await prisma.purchase.create({
    data: { companyId: company.id, userId: (await prisma.companyMember.findFirstOrThrow({ where: { companyId: company.id } })).userId, packId: pack.id, credits: 5, priceHtCents: 4500, vatRateBp: 2000, vatCents: 900, priceTtcCents: 5400, stripeCheckoutId: `cs_test_e2e_${run}` },
  });
  const redirectOnly = await call(loueur, "GET", `/loueur/portefeuille?achat=${purchase.id}`);
  check("Redirection navigateur seule : aucun crédit, « en cours de confirmation »", redirectOnly.text.includes("en cours de confirmation") && (await prisma.creditWallet.findUniqueOrThrow({ where: { companyId: company.id } })).balance === 2);
  const payload = JSON.stringify({ id: `evt_e2e_${run}`, object: "event", type: "checkout.session.completed", data: { object: { id: purchase.stripeCheckoutId, object: "checkout.session", payment_status: "paid", amount_total: 5400, currency: "eur", payment_intent: `pi_e2e_${run}`, metadata: { purchaseId: purchase.id }, client_reference_id: purchase.id } } });
  const badSig = await call(anon, "POST", "/api/stripe/webhook", payload, { "Stripe-Signature": "t=1,v1=deadbeef", "Content-Type": "application/json" });
  check("Webhook à signature invalide rejeté", badSig.status === 400);
  const sig = Stripe.webhooks.generateTestHeaderString({ payload, secret: WHSEC });
  const w1 = await call(anon, "POST", "/api/stripe/webhook", payload, { "Stripe-Signature": sig, "Content-Type": "application/json" });
  const w2 = await call(anon, "POST", "/api/stripe/webhook", payload, { "Stripe-Signature": sig, "Content-Type": "application/json" });
  check("Webhook signé : crédits ajoutés", w1.json?.outcome === "granted", w1.text);
  check("Webhook rejoué : ignoré", w2.json?.outcome === "duplicate-event", w2.text);
  check("Solde final = 2 + 5", (await prisma.creditWallet.findUniqueOrThrow({ where: { companyId: company.id } })).balance === 7);

  const integrations = await call(admin, "GET", "/admin/integrations");
  check("Admin : intégrations email/SMS signalées non configurées", integrations.text.includes("Non configuré"));

  await prisma.$disconnect();
  console.log(failures ? `\n${failures} échec(s)` : "\nTous les contrôles de bout en bout sont passés.");
  process.exit(failures ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
