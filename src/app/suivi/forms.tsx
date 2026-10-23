"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";
import { Check, Verify } from "../demande/wizard";

export function ResendLinkForm() {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const r = await callApi<{ message: string }>("/api/suivi/lien", "POST", { identifier: value });
      setBusy(false);
      setMsg(r.ok ? { tone: "success", text: r.data.message } : { tone: "error", text: r.message });
    }}>
      <label className="block">
        <span className="label">Email ou téléphone vérifié lors de votre demande</span>
        <input className="input" value={value} onChange={(e) => setValue(e.target.value)} required />
      </label>
      <button className="btn-primary" disabled={busy}>Recevoir un lien</button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}

type Company = { id: string; name: string };

export function ClientActions({ requestId, status, unlocked }: { requestId: string; status: string; unlocked: Company[] }) {
  const router = useRouter();
  const [panel, setPanel] = useState<null | "fulfilled" | "close" | "cancel" | "report">(null);
  const [chosen, setChosen] = useState<string>("");
  const [reason, setReason] = useState("");
  const [reportReason, setReportReason] = useState("CONTACT_ABUSE");
  const [reportCompany, setReportCompany] = useState("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const closed = ["FULFILLED", "CLOSED", "CANCELLED", "ARCHIVED"].includes(status);

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setMsg(null);
    const r = await callApi(`/api/requests/${requestId}/status`, "POST", { action, ...extra });
    if (!r.ok) return setMsg({ tone: "error", text: r.message });
    setPanel(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {!closed && (
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary btn-sm" onClick={() => setPanel("fulfilled")}>J&apos;ai trouvé un loueur</button>
          {status === "PUBLISHED" && <button className="btn-secondary btn-sm" onClick={() => act("pause")}>Arrêter les nouveaux contacts</button>}
          {status === "PAUSED" && <button className="btn-secondary btn-sm" onClick={() => act("resume")}>Reprendre les contacts</button>}
          <button className="btn-secondary btn-sm" onClick={() => setPanel("close")}>Fermer la demande</button>
          <button className="btn-danger btn-sm" onClick={() => setPanel("cancel")}>Annuler la demande</button>
        </div>
      )}
      <button className="text-sm font-medium text-ink-soft underline" onClick={() => setPanel("report")}>Signaler un problème</button>

      {panel === "fulfilled" && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="font-medium">Quel loueur avez-vous choisi ? (pour information, aucune commission)</p>
          <select className="input mt-2" value={chosen} onChange={(e) => setChosen(e.target.value)}>
            <option value="">Un autre loueur / je préfère ne pas le dire</option>
            {unlocked.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-primary btn-sm mt-3" onClick={() => act("fulfilled", { chosenCompanyId: chosen || null })}>Confirmer</button>
        </div>
      )}
      {(panel === "close" || panel === "cancel") && (
        <div className="rounded-lg border border-slate-200 p-4">
          <p className="font-medium">{panel === "close" ? "Fermer" : "Annuler"} la demande : plus aucune entreprise ne pourra la débloquer.</p>
          <input className="input mt-2" placeholder="Motif (facultatif)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
          <button className="btn-danger btn-sm mt-3" onClick={() => act(panel, { reason })}>Confirmer</button>
        </div>
      )}
      {panel === "report" && (
        <form className="space-y-2 rounded-lg border border-slate-200 p-4" onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const r = await callApi(`/api/requests/${requestId}/report`, "POST", { reason: reportReason, message: fd.get("message"), companyId: reportCompany || null });
          setMsg(r.ok ? { tone: "success", text: "Signalement transmis à l'administration." } : { tone: "error", text: r.message });
          if (r.ok) setPanel(null);
        }}>
          <select className="input" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
            <option value="CONTACT_ABUSE">Démarchage abusif ou comportement inapproprié</option>
            <option value="NOT_ME">Je n&apos;ai pas fait cette demande</option>
            <option value="DATA">Question sur mes données</option>
            <option value="OTHER">Autre problème</option>
          </select>
          {unlocked.length > 0 && (
            <select className="input" value={reportCompany} onChange={(e) => setReportCompany(e.target.value)}>
              <option value="">Entreprise concernée (facultatif)</option>
              {unlocked.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          <textarea name="message" className="input" rows={3} required minLength={5} placeholder="Décrivez le problème" />
          <button className="btn-primary btn-sm">Envoyer</button>
        </form>
      )}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

export function DraftCompletion({ requestId, pref, email, phone, emailVerified, phoneVerified, maxUnlocks }: {
  requestId: string; pref: string; email: string | null; phone: string | null; emailVerified: boolean; phoneVerified: boolean; maxUnlocks: number;
}) {
  const router = useRouter();
  const [v, setV] = useState({ EMAIL: emailVerified, PHONE: phoneVerified });
  const [recipients, setRecipients] = useState<{ id: string; name: string; city: string }[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const wantsEmail = pref !== "PHONE";
  const wantsPhone = pref !== "EMAIL";
  const all = (!wantsEmail || v.EMAIL) && (!wantsPhone || v.PHONE);
  const channels = pref === "BOTH" ? "téléphone et email" : pref === "PHONE" ? "téléphone" : "email";
  return (
    <div className="space-y-3">
      {wantsEmail && email && <Verify requestId={requestId} channel="EMAIL" target={email} verified={v.EMAIL} onVerified={() => setV((x) => ({ ...x, EMAIL: true }))} />}
      {wantsPhone && phone && <Verify requestId={requestId} channel="PHONE" target={phone} verified={v.PHONE} onVerified={() => setV((x) => ({ ...x, PHONE: true }))} />}
      {all && !recipients && (
        <button className="btn-primary" onClick={async () => {
          const r = await callApi<{ recipients: { id: string; name: string; city: string }[] }>(`/api/requests/${requestId}/recipients`, "POST", {});
          if (!r.ok) return setErr(r.message);
          setRecipients(r.data.recipients);
        }}>Voir les destinataires</button>
      )}
      {recipients && recipients.length === 0 && <Alert tone="warn">Aucune entreprise inscrite ne correspond pour le moment. Votre demande n&apos;est pas diffusée.</Alert>}
      {recipients && recipients.length > 0 && (
        <div className="space-y-3">
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">{recipients.map((r) => <li key={r.id} className="px-3 py-2">{r.name} <span className="text-sm text-ink-mute">· {r.city}</span></li>)}</ul>
          <Alert tone="info">{maxUnlocks} entreprises au maximum parmi celles-ci pourront obtenir vos coordonnées ({channels}) et l&apos;adresse du chantier.</Alert>
          <Check checked={consent} onChange={setConsent} label={`Je demande à être contacté(e) par ${channels} au sujet de cette demande, par ${maxUnlocks} entreprises au maximum parmi celles listées.`} />
          <Check checked={marketing} onChange={setMarketing} label="Facultatif : j'accepte de recevoir des informations commerciales de la plateforme." hint="Sans lien avec votre demande." />
          <button className="btn-primary" disabled={!consent} onClick={async () => {
            const r = await callApi(`/api/requests/${requestId}/publish`, "POST", { contactConsent: consent, marketingConsent: marketing });
            if (!r.ok) return setErr(r.message);
            router.refresh();
          }}>Recevoir des propositions</button>
        </div>
      )}
      {err && <Alert tone="error">{err}</Alert>}
    </div>
  );
}

export function CreateAccountForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi(`/api/requests/${requestId}/account`, "POST", { password: pw });
      if (!r.ok) return setMsg(r.message);
      router.refresh();
    }}>
      <input type="password" className="input" placeholder="Choisissez un mot de passe (10 caractères min.)" value={pw} onChange={(e) => setPw(e.target.value)} minLength={10} required autoComplete="new-password" />
      <button className="btn-secondary">Créer mon compte</button>
      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </form>
  );
}
