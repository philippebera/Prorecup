"use strict";
/* Shortfilm : serveur Express (site statique + réception des propositions de courts) */
const express = require("express");
const compression = require("compression");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DATA_DIR, "propositions.jsonl");
/* Clé pour télécharger les propositions. À définir via la variable d'environnement ADMIN_KEY (hPanel). */
const ADMIN_KEY = process.env.ADMIN_KEY || crypto.randomBytes(18).toString("hex"); /* sans ADMIN_KEY, clé aléatoire à chaque démarrage */
if (!process.env.ADMIN_KEY) console.warn("ADMIN_KEY non défini : clé temporaire", ADMIN_KEY);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(compression());
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

/* --- propositions de courts envoyées depuis le Studio (même format que Netlify Forms) --- */
const hits = new Map();
function limited(ip) {
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < 3600e3);
  list.push(now); hits.set(ip, list);
  return list.length > 8;
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const YT = /^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/;
const cut = (v, n) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").trim().slice(0, n);

app.post("/", express.urlencoded({ extended: false, limit: "20kb" }), (req, res) => {
  const b = req.body || {};
  if (b["form-name"] !== "proposition") return res.status(400).send("Requête invalide");
  if (b["bot-field"]) return res.status(200).send("ok");           /* robot : on fait semblant */
  if (limited(req.ip)) return res.status(429).send("Trop de demandes");
  const rec = {
    date: new Date().toISOString(),
    email: cut(b.email, 120), titre: cut(b.titre, 80), lien: cut(b.lien, 60),
    genre: cut(b.genre, 40), langue: cut(b.langue, 40), pays: cut(b.pays, 40),
    duree: cut(b.duree, 3), synopsis: cut(b.synopsis, 400), droits: cut(b.droits, 3)
  };
  if (!EMAIL.test(rec.email) || !rec.titre || !YT.test(rec.lien) || rec.droits !== "oui") return res.status(400).send("Données invalides");
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.appendFileSync(FILE, JSON.stringify(rec) + "\n");
  } catch (e) { console.error("Écriture impossible :", e.message); return res.status(500).send("Erreur serveur"); }
  res.status(200).send("ok");
});

/* --- téléchargement des propositions : /admin/propositions.csv?key=VOTRE_CLE --- */
app.get("/admin/propositions.csv", (req, res) => {
  const given = Buffer.from(String(req.query.key || "")), good = Buffer.from(ADMIN_KEY);
  if (given.length !== good.length || !crypto.timingSafeEqual(given, good)) return res.status(404).send("Not found");
  const cols = ["date", "email", "titre", "lien", "genre", "langue", "pays", "duree", "synopsis", "droits"];
  const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  let rows = [];
  try { rows = fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch (e) {}
  const csv = "\ufeff" + cols.join(",") + "\n" + rows.map(r => cols.map(c => q(r[c])).join(",")).join("\n") + "\n";
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="propositions.csv"');
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  res.send(csv);
});

/* --- site --- */
app.use(express.static(path.join(__dirname, "public"), {
  index: "index.html",
  setHeaders: (res, p) => {
    if (p.includes(path.sep + "photos" + path.sep)) res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    else if (p.endsWith(".html")) res.setHeader("Cache-Control", "no-cache");
  }
}));

app.listen(PORT, () => console.log("Shortfilm en ligne sur le port " + PORT));
