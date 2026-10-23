"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/lib/client-api";

/** Bouton qui appelle une API puis rafraîchit la page. */
export function ActionButton({
  url, method = "POST", data, label, confirm, className = "btn-secondary btn-sm", redirect, onDone, prompt,
}: {
  url: string; method?: string; data?: Record<string, unknown>; label: ReactNode; confirm?: string; className?: string; redirect?: string; onDone?: () => void;
  prompt?: { field: string; question: string; minLength?: number };
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={async () => {
          if (confirm && !window.confirm(confirm)) return;
          let payload = data;
          if (prompt) {
            const v = window.prompt(prompt.question);
            if (v == null) return;
            if (v.trim().length < (prompt.minLength ?? 3)) {
              setError("Motif trop court");
              return;
            }
            payload = { ...data, [prompt.field]: v.trim() };
          }
          setBusy(true);
          setError(null);
          const r = await callApi(url, method, payload);
          setBusy(false);
          if (!r.ok) return setError(r.message);
          onDone?.();
          if (redirect) router.push(redirect);
          else router.refresh();
        }}
      >
        {busy ? "…" : label}
      </button>
      {error && <span className="mt-1 text-xs text-red-700">{error}</span>}
    </span>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      aria-label="Déconnexion"
      className="grid h-9 w-9 place-items-center rounded-full bg-white text-sm font-semibold text-ink-soft ring-1 ring-black/[0.06] hover:text-ink sm:w-auto sm:px-3.5"
      onClick={async () => {
        await callApi("/api/auth/logout", "POST", {});
        router.push("/");
        router.refresh();
      }}
    >
      <span className="hidden sm:inline">Déconnexion</span>
      <svg aria-hidden className="h-4 w-4 sm:hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></svg>
    </button>
  );
}

type Toast = { id: string; title: string; body: string; link?: string | null };

/** Notifications internes en temps réel + pop-up quand l'application est ouverte. */
export function NotificationListener() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unread, setUnread] = useState(0);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  useEffect(() => {
    if (typeof EventSource === "undefined") return;
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("unread", (e) => setUnread(JSON.parse((e as MessageEvent).data).count));
    es.addEventListener("notification", (e) => {
      const n = JSON.parse((e as MessageEvent).data) as Toast;
      setToasts((t) => [...t.slice(-2), n]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== n.id)), 9000);
      routerRef.current.refresh();
    });
    return () => es.close();
  }, []);
  return (
    <>
      <Link href="/notifications" className="relative grid h-9 w-9 place-items-center rounded-full bg-white text-sm ring-1 ring-black/[0.06]" aria-label={`Notifications (${unread} non lues)`}>
        🔔{unread > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-lime px-1.5 text-[10px] font-extrabold text-ink ring-2 ring-canvas">{unread}</span>}
      </Link>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full max-w-sm rounded-3xl bg-ink p-4 text-white shadow-float">
            <p className="font-semibold">{t.title}</p>
            <p className="mt-1 text-sm text-white/70">{t.body}</p>
            <div className="mt-2 flex gap-3 text-sm">
              {t.link && <Link className="rounded-full bg-lime px-3 py-1 font-semibold text-ink" href={t.link}>Voir</Link>}
              <button className="text-white/60" onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))}>Fermer</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

/** Abonnement Web Push (si supporté par le navigateur et configuré côté serveur). */
export function PushToggle({ configured, vapidKey }: { configured: boolean; vapidKey: string }) {
  const [state, setState] = useState<"unknown" | "unsupported" | "on" | "off" | "denied">("unknown");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.getRegistration("/sw.js").then(async (reg) => setState((await reg?.pushManager.getSubscription()) ? "on" : "off"));
  }, []);
  if (!configured) return <p className="text-sm text-ink-mute">Notifications push : non configurées sur la plateforme (clés VAPID absentes).</p>;
  if (state === "unsupported") return <p className="text-sm text-ink-mute">Votre navigateur ne prend pas en charge les notifications push (sur iPhone : ajoutez d&apos;abord le site à l&apos;écran d&apos;accueil).</p>;
  if (state === "denied") return <p className="text-sm text-ink-mute">Notifications bloquées dans les réglages de votre navigateur.</p>;
  const toBytes = (b64: string) => {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  };
  return (
    <div className="flex items-center gap-3">
      <button
        className="btn-secondary btn-sm"
        onClick={async () => {
          setMsg(null);
          const reg = await navigator.serviceWorker.register("/sw.js");
          if (state === "on") {
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
              await callApi("/api/push", "DELETE", { endpoint: sub.endpoint });
              await sub.unsubscribe();
            }
            return setState("off");
          }
          const perm = await Notification.requestPermission();
          if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
          const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(vapidKey) });
          const r = await callApi("/api/push", "POST", sub.toJSON());
          if (!r.ok) return setMsg(r.message);
          setState("on");
        }}
      >
        {state === "on" ? "Désactiver les notifications push sur cet appareil" : "Activer les notifications push sur cet appareil"}
      </button>
      {msg && <span className="text-sm text-red-700">{msg}</span>}
    </div>
  );
}
