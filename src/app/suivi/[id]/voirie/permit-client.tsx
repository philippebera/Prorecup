"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";

type Init = { locationDetails: string; startDate: string; endDate: string; lengthM: string; widthM: string; heightM: string; dimensionsConfirmed: boolean; applicantName: string; applicantQuality: string; authorityId: string; notes: string };

export function PermitForm({ requestId, initial, authorities, address, locked }: { requestId: string; initial: Init; authorities: { id: string; name: string }[]; address: string; locked: boolean }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const set = (k: keyof Init, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v ? Number(v.replace(",", ".")) : null);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi(`/api/requests/${requestId}/permit`, "PUT", {
        ...f, lengthM: num(f.lengthM), widthM: num(f.widthM), heightM: num(f.heightM), startDate: f.startDate || null, endDate: f.endDate || null, authorityId: f.authorityId || null,
      });
      setMsg(r.ok ? { tone: "success", text: "Dossier enregistré." } : { tone: "error", text: r.message });
      router.refresh();
    }}>
      <p className="text-sm">Adresse : <strong>{address}</strong></p>
      <fieldset disabled={locked} className="space-y-3">
        <label className="block"><span className="label">Emplacement précis</span><textarea className="input" rows={2} value={f.locationDetails} onChange={(e) => set("locationDetails", e.target.value)} placeholder="Ex. : sur 2 places de stationnement devant le n°12, côté pair" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label><span className="label">Du</span><input type="date" className="input" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></label>
          <label><span className="label">Au</span><input type="date" className="input" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></label>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <label><span className="label">Longueur (m)</span><input className="input" inputMode="decimal" value={f.lengthM} onChange={(e) => set("lengthM", e.target.value)} /></label>
          <label><span className="label">Largeur (m)</span><input className="input" inputMode="decimal" value={f.widthM} onChange={(e) => set("widthM", e.target.value)} /></label>
          <label><span className="label">Hauteur (m)</span><input className="input" inputMode="decimal" value={f.heightM} onChange={(e) => set("heightM", e.target.value)} /></label>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={f.dimensionsConfirmed} onChange={(e) => set("dimensionsConfirmed", e.target.checked)} />Dimensions confirmées par le loueur</label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Nom du demandeur</span><input className="input" value={f.applicantName} onChange={(e) => set("applicantName", e.target.value)} /></label>
          <label><span className="label">Qualité (facultatif)</span><input className="input" value={f.applicantQuality} onChange={(e) => set("applicantQuality", e.target.value)} placeholder="Propriétaire, entreprise de travaux…" /></label>
        </div>
        <label className="block"><span className="label">Autorité destinataire</span>
          <select className="input" value={f.authorityId} onChange={(e) => set("authorityId", e.target.value)}>
            <option value="">— À identifier —</option>
            {authorities.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">Remarques</span><textarea className="input" rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
        <button className="btn-primary">Enregistrer</button>
      </fieldset>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}

export function PermitUpload({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [kind, setKind] = useState("PLAN");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end" onSubmit={async (e) => {
      e.preventDefault();
      const fd = new FormData(e.currentTarget);
      fd.set("kind", kind);
      const r = await callApi(`/api/requests/${requestId}/permit/files`, "POST", fd);
      setMsg(r.ok ? "Document ajouté." : r.message);
      if (r.ok) (e.target as HTMLFormElement).reset();
      router.refresh();
    }}>
      <label><span className="label">Type</span>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="PLAN">Plan d&apos;implantation</option>
          <option value="PHOTO">Photo de l&apos;emplacement</option>
          <option value="AUTHORIZATION">Autorisation obtenue</option>
          <option value="OTHER">Autre document</option>
        </select>
      </label>
      <input type="file" name="file" accept="image/jpeg,image/png,application/pdf" required className="text-sm" />
      <button className="btn-secondary btn-sm">Ajouter</button>
      {msg && <span className="text-sm">{msg}</span>}
    </form>
  );
}

const NEXT: Record<string, { status: string; label: string }[]> = {
  READY: [{ status: "SENT_BY_USER", label: "J'ai envoyé ma demande à l'autorité" }],
  SENT_BY_USER: [
    { status: "RECEIPT_CONFIRMED", label: "L'autorité a confirmé la réception" },
    { status: "INFO_REQUESTED", label: "Un complément m'est demandé" },
    { status: "GRANTED", label: "L'autorisation m'a été accordée" },
    { status: "REFUSED", label: "Ma demande a été refusée" },
  ],
  RECEIPT_CONFIRMED: [
    { status: "INFO_REQUESTED", label: "Un complément m'est demandé" },
    { status: "GRANTED", label: "L'autorisation m'a été accordée" },
    { status: "REFUSED", label: "Ma demande a été refusée" },
  ],
  INFO_REQUESTED: [
    { status: "SENT_BY_USER", label: "J'ai envoyé le complément" },
    { status: "GRANTED", label: "L'autorisation m'a été accordée" },
    { status: "REFUSED", label: "Ma demande a été refusée" },
  ],
  REFUSED: [{ status: "TO_PREPARE", label: "Préparer une nouvelle demande" }],
};

export function PermitStatusActions({ requestId, status, hasAuthorization }: { requestId: string; status: string; hasAuthorization: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const options = NEXT[status] ?? [];
  if (status === "TO_PREPARE") return <p className="text-sm text-ink-soft">Complétez les étapes 1 et 2 : le dossier passera automatiquement à « Prêt ».</p>;
  if (!options.length) return <p className="text-sm text-ink-soft">Dossier clôturé.</p>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button key={o.status} className="btn-secondary btn-sm" onClick={async () => {
            if (o.status === "GRANTED" && !hasAuthorization) return setMsg("Ajoutez d'abord le document d'autorisation reçu (étape 3, type « Autorisation obtenue »).");
            const note = o.status === "INFO_REQUESTED" ? window.prompt("Quel complément est demandé ?") ?? undefined : undefined;
            const r = await callApi(`/api/requests/${requestId}/permit/status`, "POST", { status: o.status, note });
            setMsg(r.ok ? null : r.message);
            router.refresh();
          }}>{o.label}</button>
        ))}
      </div>
      {msg && <p className="text-sm text-red-700">{msg}</p>}
    </div>
  );
}

export function PermitSend({ requestId, to, ready }: { requestId: string; to: string; ready: boolean }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-lg border border-slate-200 p-3 text-sm">
      <p>Canal de dépôt vérifié par l&apos;administration : <strong>{to}</strong>.</p>
      <label className="mt-2 flex items-start gap-2"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={ok} onChange={(e) => setOk(e.target.checked)} />J&apos;ai relu le dossier et je demande son envoi à cette adresse en mon nom.</label>
      <button className="btn-primary btn-sm mt-2" disabled={!ok || !ready} onClick={async () => {
        const r = await callApi(`/api/requests/${requestId}/permit/send`, "POST", { confirmed: ok });
        setMsg(r.ok ? "Dossier envoyé. Ce n'est pas une autorisation : attendez la réponse de l'autorité." : r.message);
        router.refresh();
      }}>Envoyer depuis l&apos;application</button>
      {!ready && <p className="mt-1 text-ink-mute">Complétez le dossier avant l&apos;envoi.</p>}
      {msg && <p className="mt-2">{msg}</p>}
    </div>
  );
}
