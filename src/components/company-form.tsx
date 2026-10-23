"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/lib/client-api";
import { DEPARTMENTS } from "@/lib/geo";
import { SERVICES, SKIP_SIZES_M3, WASTE_TYPES } from "@/lib/catalog";
import { Alert } from "./ui";

export type CompanyFormValues = {
  legalName: string; tradeName: string; siret: string; vatNumber: string; email: string; phone: string; website: string;
  addressLine: string; postalCode: string; city: string; description: string; skipSizesM3: number[]; wasteTypes: string[];
  services: string[]; departments: string[]; postalCodes: string; openingHours: string; availabilityNote: string; publicProfile: boolean;
  billingName: string; billingEmail: string; billingAddress: string; billingPostalCode: string; billingCity: string;
  ownerName: string; ownerEmail: string; ownerPhone: string; password: string; establishmentName: string; acceptTerms: boolean;
};

export const emptyCompany: CompanyFormValues = {
  legalName: "", tradeName: "", siret: "", vatNumber: "", email: "", phone: "", website: "", addressLine: "", postalCode: "", city: "",
  description: "", skipSizesM3: [], wasteTypes: [], services: [], departments: [], postalCodes: "", openingHours: "", availabilityNote: "",
  publicProfile: true, billingName: "", billingEmail: "", billingAddress: "", billingPostalCode: "", billingCity: "",
  ownerName: "", ownerEmail: "", ownerPhone: "", password: "", establishmentName: "", acceptTerms: false,
};

export function CompanyForm({ mode, initial }: { mode: "register" | "edit"; initial: CompanyFormValues }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CompanyFormValues>(k: K, v: CompanyFormValues[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = <K extends "skipSizesM3" | "wasteTypes" | "services" | "departments">(k: K, v: CompanyFormValues[K][number]) =>
    setF((s) => {
      const arr = s[k] as (string | number)[];
      return { ...s, [k]: arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v] };
    });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    const payload = {
      ...f,
      tradeName: f.tradeName || null, vatNumber: f.vatNumber || null, website: f.website || null, description: f.description || null,
      openingHours: f.openingHours || null, availabilityNote: f.availabilityNote || null, ownerPhone: f.ownerPhone || null,
      postalCodes: f.postalCodes.split(/[\s,;]+/).filter(Boolean),
    };
    const r = await callApi<{ redirect?: string }>(mode === "register" ? "/api/loueur/register" : "/api/loueur/company", mode === "register" ? "POST" : "PUT", payload);
    setBusy(false);
    if (!r.ok) return setErr(r.issues?.[0] ? `${r.issues[0].path} : ${r.issues[0].message}` : r.message);
    if (mode === "register") router.push(r.data.redirect ?? "/loueur");
    else {
      setOk(true);
      router.refresh();
    }
  }

  const input = (k: keyof CompanyFormValues, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className="block">
      <span className="label">{label}</span>
      <input className="input" value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} {...props} />
    </label>
  );

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Entreprise</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("legalName", "Raison sociale", { required: true })}
          {input("tradeName", "Nom commercial (facultatif)")}
          {mode === "register" ? input("siret", "SIRET (14 chiffres)", { required: true, inputMode: "numeric" }) : <p className="text-sm"><span className="label">SIRET</span>{f.siret} <span className="text-ink-mute">(modifiable par l&apos;administration)</span></p>}
          {input("vatNumber", "N° TVA intracommunautaire (facultatif)")}
          {input("email", "Email de contact", { type: "email", required: true })}
          {input("phone", "Téléphone", { type: "tel", required: true })}
          {input("website", "Site web (facultatif)", { type: "url", placeholder: "https://" })}
        </div>
        {input("addressLine", "Adresse du siège ou de l'établissement principal", { required: true })}
        <div className="grid grid-cols-3 gap-3">
          {input("postalCode", "Code postal", { required: true, inputMode: "numeric", maxLength: 5 })}
          <div className="col-span-2">{input("city", "Commune", { required: true })}</div>
        </div>
        <label className="block"><span className="label">Présentation (profil public)</span><textarea className="input" rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={1500} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={f.publicProfile} onChange={(e) => set("publicProfile", e.target.checked)} />Afficher un profil public (après validation)</label>
      </section>

      <section className="card space-y-4">
        <h2 className="text-lg font-bold">Services proposés <span className="text-sm font-normal text-ink-mute">(déclaratif)</span></h2>
        <fieldset><legend className="label">Tailles de bennes (m³)</legend>
          <div className="flex flex-wrap gap-2">{SKIP_SIZES_M3.map((s) => <Pill key={s} on={f.skipSizesM3.includes(s)} onClick={() => toggle("skipSizesM3", s)}>{s} m³</Pill>)}</div>
        </fieldset>
        <fieldset><legend className="label">Types de déchets acceptés</legend>
          <div className="flex flex-wrap gap-2">{WASTE_TYPES.map((w) => <Pill key={w.code} on={f.wasteTypes.includes(w.code)} onClick={() => toggle("wasteTypes", w.code)}>{w.icon} {w.label}</Pill>)}</div>
        </fieldset>
        <fieldset><legend className="label">Services</legend>
          <div className="flex flex-wrap gap-2">{SERVICES.map((s) => <Pill key={s.code} on={f.services.includes(s.code)} onClick={() => toggle("services", s.code)}>{s.label}</Pill>)}</div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          {input("openingHours", "Horaires", { placeholder: "Lun-ven 7 h 30 – 18 h" })}
          {input("availabilityNote", "Disponibilité déclarée", { placeholder: "Ex. : pose sous 48 h en général" })}
        </div>
        <p className="text-xs text-ink-mute">La disponibilité déclarée n&apos;est jamais présentée aux clients comme garantie.</p>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Zones desservies</h2>
        <p className="text-sm text-ink-soft">Vous recevrez les demandes des départements cochés. Pour une couverture partielle d&apos;un département, indiquez plutôt des codes postaux.</p>
        <div className="grid max-h-64 grid-cols-2 gap-1 overflow-y-auto rounded-lg border border-slate-200 p-2 text-sm sm:grid-cols-3">
          {Object.entries(DEPARTMENTS).map(([code, name]) => (
            <label key={code} className="flex items-center gap-2"><input type="checkbox" className="accent-brand-600" checked={f.departments.includes(code)} onChange={() => toggle("departments", code)} />{code} {name}</label>
          ))}
        </div>
        <label className="block"><span className="label">Codes postaux supplémentaires (hors départements cochés)</span><input className="input" value={f.postalCodes} onChange={(e) => set("postalCodes", e.target.value)} placeholder="69100, 69200…" /></label>
      </section>

      {mode === "edit" && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Informations de facturation</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("billingName", "Nom de facturation")}
            {input("billingEmail", "Email de facturation", { type: "email" })}
          </div>
          {input("billingAddress", "Adresse de facturation")}
          <div className="grid grid-cols-3 gap-3">{input("billingPostalCode", "Code postal")}<div className="col-span-2">{input("billingCity", "Commune")}</div></div>
        </section>
      )}

      {mode === "register" && (
        <section className="card space-y-3">
          <h2 className="text-lg font-bold">Contact principal</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {input("ownerName", "Nom et prénom", { required: true, autoComplete: "name" })}
            {input("ownerEmail", "Email de connexion", { type: "email", required: true, autoComplete: "email" })}
            {input("ownerPhone", "Téléphone (facultatif)", { type: "tel" })}
            {input("password", "Mot de passe (10 caractères min.)", { type: "password", required: true, minLength: 10, autoComplete: "new-password" })}
          </div>
          <p className="text-sm text-ink-soft">Vous pourrez inviter d&apos;autres utilisateurs de l&apos;entreprise. Les crédits sont partagés au niveau de l&apos;entreprise.</p>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-0.5 h-5 w-5 accent-brand-600" checked={f.acceptTerms} onChange={(e) => set("acceptTerms", e.target.checked)} required />
            <span>J&apos;accepte les <Link className="underline" href="/legal/conditions-loueurs" target="_blank">conditions loueurs et crédits</Link> et m&apos;engage à n&apos;utiliser les coordonnées obtenues que pour répondre aux demandes, sans prospection publicitaire.</span>
          </label>
        </section>
      )}

      {err && <Alert tone="error">{err}</Alert>}
      {ok && <Alert tone="success">Modifications enregistrées.</Alert>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? "…" : mode === "register" ? "Créer mon compte loueur (gratuit)" : "Enregistrer"}</button>
    </form>
  );
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand-500 bg-brand-50 font-semibold text-brand-800" : "border-slate-300 bg-white"}`}>
      {children}
    </button>
  );
}
