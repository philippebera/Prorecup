# Shortfilm

Site de streaming de courts métrages (page statique + petit serveur Express pour recevoir les propositions de courts).

## Lancer
```
npm install
ADMIN_KEY=votre_cle npm start   # http://localhost:3000
```
- `public/` : site (index.html, photos).
- `server.js` : sert le site et enregistre les propositions dans `data/propositions.jsonl`.
- Export CSV : `/admin/propositions.csv?key=ADMIN_KEY`.

Variables : `PORT`, `DATA_DIR`, `ADMIN_KEY`.
