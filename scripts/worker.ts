// Worker de la file de notifications : npm run worker
import { processQueue } from "../src/lib/notifications/queue";

async function loop() {
  for (;;) {
    try {
      const r = await processQueue(50);
      if (r.claimed) console.log(new Date().toISOString(), r);
    } catch (e) {
      console.error("Erreur worker", e);
    }
    await new Promise((res) => setTimeout(res, 5000));
  }
}
loop();
