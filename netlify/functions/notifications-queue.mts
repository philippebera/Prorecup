// Fonction planifiée Netlify : remplace le worker permanent (`npm run worker`).
// Elle appelle chaque minute la route protégée /api/cron/notifications.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("URL ou CRON_SECRET manquant : file de notifications non traitée");
    return;
  }
  const res = await fetch(`${base}/api/cron/notifications`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  console.log("File de notifications", res.status, (await res.text()).slice(0, 300));
};

export const config = { schedule: "* * * * *" };
