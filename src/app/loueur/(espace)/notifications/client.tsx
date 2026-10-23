"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";

type Prefs = { notifyEmail: boolean; notifySms: boolean; notifyPush: boolean; notifyQuietStart: number | null; notifyQuietEnd: number | null; smsPhone: string };

export function PrefsForm({ initial, smsAvailable }: { initial: Prefs; smsAvailable: boolean }) {
  const router = useRouter();
  const [p, setP] = useState(initial);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const hours = Array.from({ length: 24 }, (_, i) => i);
  return (
    <form className="card space-y-4" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi("/api/loueur/prefs", "PUT", { ...p, smsPhone: p.smsPhone || null });
      setMsg(r.ok ? { tone: "success", text: "Préférences enregistrées." } : { tone: "error", text: r.message });
      router.refresh();
    }}>
      <p className="text-sm text-ink-soft">Les notifications dans l&apos;application sont toujours actives.</p>
      <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={p.notifyEmail} onChange={(e) => setP({ ...p, notifyEmail: e.target.checked })} />Email à chaque utilisateur</label>
      <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={p.notifyPush} onChange={(e) => setP({ ...p, notifyPush: e.target.checked })} />Notifications push (appareils abonnés)</label>
      <div>
        <label className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-brand-600" disabled={!smsAvailable} checked={p.notifySms} onChange={(e) => setP({ ...p, notifySms: e.target.checked })} />SMS pour les nouvelles demandes (un seul SMS par demande pour l&apos;entreprise, plafonné par jour)</label>
        {p.notifySms && <input className="input mt-2 max-w-xs" placeholder="Numéro mobile" value={p.smsPhone} onChange={(e) => setP({ ...p, smsPhone: e.target.value })} />}
      </div>
      <fieldset>
        <legend className="label">Plage de silence (email, push, SMS différés)</legend>
        <div className="flex items-center gap-2 text-sm">
          De
          <select className="input w-24" value={p.notifyQuietStart ?? ""} onChange={(e) => setP({ ...p, notifyQuietStart: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">—</option>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
          à
          <select className="input w-24" value={p.notifyQuietEnd ?? ""} onChange={(e) => setP({ ...p, notifyQuietEnd: e.target.value === "" ? null : Number(e.target.value) })}>
            <option value="">—</option>{hours.map((h) => <option key={h} value={h}>{h} h</option>)}
          </select>
        </div>
      </fieldset>
      <button className="btn-primary">Enregistrer</button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}
