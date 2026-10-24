// Fonction planifiée Netlify : anonymisation quotidienne selon les durées de conservation.
export default async () => {
  const base = process.env.URL;
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) {
    console.error("URL ou CRON_SECRET manquant : purge non effectuée");
    return;
  }
  const res = await fetch(`${base}/api/cron/notifications?purge=1`, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
  console.log("Purge quotidienne", res.status, (await res.text()).slice(0, 300));
};

export const config = { schedule: "@daily" };
