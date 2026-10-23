"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { callApi } from "@/lib/client-api";
import { ACCESS_FLAGS, GLOBAL_EXCLUSIONS, SKIP_SIZES_M3, VOLUME_HINTS, WASTE_TYPES } from "@/lib/catalog";
import { CALLBACK_SLOTS } from "@/lib/requests/schema";
import { Alert } from "@/components/ui";

type Form = {
  clientType: "INDIVIDUAL" | "PROFESSIONAL" | "";
  companyName: string;
  addressLine: string;
  addressComplement: string;
  postalCode: string;
  city: string;
  startDate: string;
  endDate: string;
  flexibleDates: boolean;
  urgent: boolean;
  wasteTypes: string[];
  wasteNotes: string;
  volumeM3: number | null | undefined; // undefined = non répondu, null = je ne sais pas
  placement: "PRIVATE" | "PUBLIC_ROAD" | "UNKNOWN" | "";
  accessFlags: string[];
  accessDetails: string;
  contactPreference: "PHONE" | "EMAIL" | "BOTH" | "";
  contactName: string;
  email: string;
  phone: string;
  callbackSlots: string[];
  website: string;
};

const initial: Form = {
  clientType: "", companyName: "", addressLine: "", addressComplement: "", postalCode: "", city: "", startDate: "", endDate: "",
  flexibleDates: false, urgent: false, wasteTypes: [], wasteNotes: "", volumeM3: undefined, placement: "", accessFlags: [], accessDetails: "",
  contactPreference: "", contactName: "", email: "", phone: "", callbackSlots: [], website: "",
};

const STEPS = ["Vous", "Chantier", "Dates", "Déchets", "Volume", "Accès", "Photos", "Contact", "Récapitulatif", "Vérification", "Diffusion"];

type Recipient = { id: string; slug: string; name: string; city: string };

export function RequestWizard({ maxUnlocks, emailAvailable, phoneAvailable, captchaSiteKey }: { maxUnlocks: number; emailAvailable: boolean; phoneAvailable: boolean; captchaSiteKey: string | null }) {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(initial);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [created, setCreated] = useState<{ id: string; publicRef: string } | null>(null);
  const [verified, setVerified] = useState<{ EMAIL: boolean; PHONE: boolean }>({ EMAIL: false, PHONE: false });
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [done, setDone] = useState<{ recipients: number } | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | undefined>(undefined);

  // Cloudflare Turnstile (uniquement si configuré)
  useEffect(() => {
    if (!captchaSiteKey || step !== 8) return;
    (window as unknown as { onBdCaptcha: (t: string) => void }).onBdCaptcha = (t: string) => setCaptchaToken(t);
    if (!document.querySelector("script[data-turnstile]")) {
      const sc = document.createElement("script");
      sc.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
      sc.async = true;
      sc.dataset.turnstile = "1";
      document.head.appendChild(sc);
    }
  }, [captchaSiteKey, step]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((s) => ({ ...s, [k]: v }));
  const toggle = (k: "wasteTypes" | "accessFlags" | "callbackSlots", v: string) =>
    setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const wantsEmail = f.contactPreference === "EMAIL" || f.contactPreference === "BOTH";
  const wantsPhone = f.contactPreference === "PHONE" || f.contactPreference === "BOTH";

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  function validate(s: number): string | null {
    switch (s) {
      case 0:
        if (!f.clientType) return "Indiquez si vous êtes un particulier ou un professionnel.";
        if (f.clientType === "PROFESSIONAL" && !f.companyName.trim()) return "Indiquez la raison sociale.";
        return null;
      case 1:
        if (f.addressLine.trim().length < 3) return "Indiquez l'adresse du chantier.";
        if (!/^\d{5}$/.test(f.postalCode)) return "Code postal à 5 chiffres.";
        if (!f.city.trim()) return "Indiquez la commune.";
        return null;
      case 2:
        if (!f.startDate || f.startDate < today) return "Choisissez une date de pose à venir.";
        if (f.endDate && f.endDate < f.startDate) return "La date de retrait doit suivre la date de pose.";
        return null;
      case 3:
        return f.wasteTypes.length ? null : "Choisissez au moins un type de déchets.";
      case 4:
        return f.volumeM3 === undefined ? "Choisissez un volume ou « Je ne sais pas »." : null;
      case 5:
        return f.placement ? null : "Indiquez où la benne sera posée.";
      case 7:
        if (!f.contactPreference) return "Choisissez comment être contacté(e).";
        if (f.contactName.trim().length < 2) return "Indiquez votre nom.";
        if (wantsEmail && !/^\S+@\S+\.\S+$/.test(f.email)) return "Email invalide.";
        if (wantsPhone && !/^(?:\+33\s?[1-9]|0[1-9])(?:[\s.-]?\d{2}){4}$/.test(f.phone.trim())) return "Numéro de téléphone français invalide.";
        if (wantsEmail && !emailAvailable) return "La vérification par email est momentanément indisponible.";
        if (wantsPhone && !phoneAvailable) return "La vérification par SMS est momentanément indisponible : choisissez le contact par email.";
        return null;
    }
    return null;
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) setStep((s) => s + 1);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const r = await callApi<{ id: string; publicRef: string }>("/api/requests", "POST", {
      ...f,
      companyName: f.companyName || null,
      endDate: f.endDate || null,
      volumeM3: f.volumeM3 ?? null,
      email: wantsEmail ? f.email.trim() : null,
      phone: wantsPhone ? f.phone.trim() : null,
      website: f.website || undefined,
      startedAt,
      captchaToken,
    });
    if (!r.ok) {
      setBusy(false);
      return setError(r.message);
    }
    if (photos.length) {
      const fd = new FormData();
      photos.forEach((p) => fd.append("photos", p));
      const up = await callApi(`/api/requests/${r.data.id}/photos`, "POST", fd);
      if (!up.ok) setError(`Demande enregistrée, mais les photos n'ont pas pu être ajoutées : ${up.message}`);
    }
    setCreated(r.data);
    setBusy(false);
    setStep(9);
  }

  async function loadRecipients() {
    if (!created) return;
    setBusy(true);
    const r = await callApi<{ recipients: Recipient[] }>(`/api/requests/${created.id}/recipients`, "POST", {});
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setRecipients(r.data.recipients);
    setStep(10);
  }

  async function publish() {
    if (!created) return;
    if (!consent) return setError("Cochez la case pour accepter d'être contacté(e) au sujet de cette demande.");
    setBusy(true);
    setError(null);
    const r = await callApi<{ recipients: number }>(`/api/requests/${created.id}/publish`, "POST", { contactConsent: consent, marketingConsent: marketing });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    setDone(r.data);
  }

  const allVerified = (!wantsEmail || verified.EMAIL) && (!wantsPhone || verified.PHONE);
  const progress = Math.round(((done ? STEPS.length : step) / STEPS.length) * 100);

  if (done && created)
    return (
      <div className="card-dark overflow-hidden text-center">
        <span aria-hidden className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime text-3xl font-black text-ink">✓</span>
        <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-white/50">Demande {created.publicRef}</p>
        <h1 className="mt-1 text-3xl font-extrabold">C&apos;est envoyé.</h1>
        <p className="mt-3 text-white/70">Transmise à {done.recipients} entreprise(s). {maxUnlocks} au maximum pourront obtenir vos coordonnées et vous contacter.</p>
        <p className="mt-2 text-sm text-white/50">Nous ne pouvons garantir ni réponse ni délai : cela dépend des loueurs.</p>
        <Link href={`/suivi/${created.id}`} className="btn-primary mt-7 w-full sm:w-auto">Suivre ma demande →</Link>
        <p className="mt-4 text-sm text-white/50">Votre espace de suivi est accessible depuis cet appareil.{wantsEmail ? " Un lien de suivi temporaire vous est aussi envoyé par email." : ""}</p>
      </div>
    );

  return (
    <div>
      <div className="card-dark mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Étape {step + 1} sur {STEPS.length}</p>
            <p className="mt-0.5 text-2xl font-extrabold">{STEPS[step]}</p>
          </div>
          <span className="rounded-full bg-lime px-3 py-1 text-sm font-extrabold text-ink">{progress} %</span>
        </div>
        <div className="mt-4 flex gap-1" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progression">
          {STEPS.map((_, i) => (
            <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step || done ? "bg-lime" : i === step ? "bg-lime/60" : "bg-white/15"}`} />
          ))}
        </div>
      </div>

      <div className="card space-y-5">
        {step === 0 && (
          <>
            <h1 className="text-xl font-bold">Vous êtes…</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              {[["INDIVIDUAL", "Un particulier", "🏠"], ["PROFESSIONAL", "Un professionnel", "🏢"]].map(([v, l, i]) => (
                <Choice key={v} selected={f.clientType === v} onClick={() => set("clientType", v as Form["clientType"])} icon={i} label={l} />
              ))}
            </div>
            {f.clientType === "PROFESSIONAL" && (
              <Field label="Raison sociale"><input className="input" value={f.companyName} onChange={(e) => set("companyName", e.target.value)} autoComplete="organization" /></Field>
            )}
          </>
        )}

        {step === 1 && (
          <>
            <h1 className="text-xl font-bold">Où se trouve le chantier ?</h1>
            <p className="text-sm text-ink-soft">L&apos;adresse exacte n&apos;est communiquée qu&apos;aux entreprises qui débloquent votre demande ({maxUnlocks} au maximum). Les autres ne voient que la commune.</p>
            <Field label="Adresse"><input className="input" value={f.addressLine} onChange={(e) => set("addressLine", e.target.value)} autoComplete="street-address" placeholder="12 rue des Lilas" /></Field>
            <Field label="Complément (facultatif)"><input className="input" value={f.addressComplement} onChange={(e) => set("addressComplement", e.target.value)} placeholder="Bâtiment, accès…" /></Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Code postal"><input className="input" inputMode="numeric" maxLength={5} value={f.postalCode} onChange={(e) => set("postalCode", e.target.value.replace(/\D/g, ""))} autoComplete="postal-code" /></Field>
              <div className="col-span-2"><Field label="Commune"><input className="input" value={f.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" /></Field></div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-xl font-bold">Quand avez-vous besoin de la benne ?</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Date de pose souhaitée"><input type="date" className="input" min={today} value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
              <Field label="Date de retrait souhaitée" hint="Facultatif"><input type="date" className="input" min={f.startDate || today} value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
            </div>
            <Check checked={f.flexibleDates} onChange={(v) => set("flexibleDates", v)} label="Mes dates sont flexibles" />
            <Check checked={f.urgent} onChange={(v) => set("urgent", v)} label="C'est urgent" hint="Les loueurs le verront ; aucun délai n'est garanti." />
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-xl font-bold">Quels déchets ?</h1>
            <p className="text-sm text-ink-soft">Plusieurs choix possibles. Un tri précis permet souvent un meilleur prix.</p>
            <div className="grid gap-3">
              {WASTE_TYPES.map((w) => (
                <button type="button" key={w.code} onClick={() => toggle("wasteTypes", w.code)} aria-pressed={f.wasteTypes.includes(w.code)}
                  className={`rounded-3xl p-4 text-left transition active:scale-[0.99] ${f.wasteTypes.includes(w.code) ? "bg-lime ring-2 ring-ink" : "bg-canvas hover:bg-lime-soft"}`}>
                  <span className="flex items-center gap-3 font-bold"><span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-xl">{w.icon}</span><span className="flex-1">{w.label}</span>{f.wasteTypes.includes(w.code) && <span aria-hidden className="grid h-6 w-6 place-items-center rounded-full bg-ink text-xs text-lime">✓</span>}</span>
                  <span className="mt-1 block text-sm text-ink-soft">Ex. : {w.examples}</span>
                  <span className="mt-0.5 block text-xs text-ink-mute">Hors : {w.excluded}</span>
                </button>
              ))}
            </div>
            <Alert tone="warn" title="Généralement refusés en benne">
              <ul className="mt-1 list-disc pl-5">{GLOBAL_EXCLUSIONS.map((x) => <li key={x}>{x}</li>)}</ul>
            </Alert>
            <Field label="Précisions (facultatif)" hint="Visible uniquement par les entreprises ayant débloqué votre demande. N'indiquez pas de coordonnées ici."><textarea className="input" rows={2} maxLength={500} value={f.wasteNotes} onChange={(e) => set("wasteNotes", e.target.value)} /></Field>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-xl font-bold">Quel volume ?</h1>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SKIP_SIZES_M3.map((v) => (
                <Choice key={v} selected={f.volumeM3 === v} onClick={() => set("volumeM3", v)} label={`${v} m³`} sub={VOLUME_HINTS[v]} />
              ))}
              <Choice selected={f.volumeM3 === null} onClick={() => set("volumeM3", null)} label="Je ne sais pas" sub="Les loueurs vous conseilleront" />
            </div>
            <Link href="/guides/choisir-volume-benne" target="_blank" className="text-sm font-bold underline decoration-lime decoration-4 underline-offset-4">Aide pour estimer le volume ↗</Link>
          </>
        )}

        {step === 5 && (
          <>
            <h1 className="text-xl font-bold">Où sera posée la benne ?</h1>
            <div className="grid gap-3 sm:grid-cols-3">
              <Choice selected={f.placement === "PRIVATE"} onClick={() => set("placement", "PRIVATE")} icon="🏡" label="Terrain privé" sub="Cour, allée, jardin" />
              <Choice selected={f.placement === "PUBLIC_ROAD"} onClick={() => set("placement", "PUBLIC_ROAD")} icon="🛣️" label="Voie publique" sub="Rue, trottoir, stationnement" />
              <Choice selected={f.placement === "UNKNOWN"} onClick={() => set("placement", "UNKNOWN")} icon="❔" label="Je ne sais pas" />
            </div>
            {f.placement === "PUBLIC_ROAD" && (
              <Alert tone="info">Une autorisation de la collectivité est généralement nécessaire. Un assistant vous aidera à préparer votre dossier après l&apos;envoi de la demande (des frais et délais publics peuvent s&apos;appliquer).</Alert>
            )}
            <fieldset>
              <legend className="label">Contraintes d&apos;accès</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {ACCESS_FLAGS.map((a) => <Check key={a.code} checked={f.accessFlags.includes(a.code)} onChange={() => toggle("accessFlags", a.code)} label={a.label} />)}
              </div>
            </fieldset>
            <Field label="Précisions sur l'accès (facultatif)" hint="Visible uniquement après déblocage. N'indiquez pas de coordonnées ici."><textarea className="input" rows={2} maxLength={500} value={f.accessDetails} onChange={(e) => set("accessDetails", e.target.value)} /></Field>
          </>
        )}

        {step === 6 && (
          <>
            <h1 className="text-xl font-bold">Photos (facultatif)</h1>
            <p className="text-sm text-ink-soft">Jusqu&apos;à 5 photos (JPEG, PNG, WebP, 8 Mo max). Elles ne sont visibles que par les entreprises ayant débloqué votre demande. Évitez les plaques d&apos;immatriculation, numéros et visages.</p>
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm" onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 5))} />
            {photos.length > 0 && <p className="text-sm">{photos.length} photo(s) sélectionnée(s).</p>}
          </>
        )}

        {step === 7 && (
          <>
            <h1 className="text-xl font-bold">Comment souhaitez-vous être contacté(e) ?</h1>
            <div className="grid gap-3 sm:grid-cols-3">
              <Choice selected={f.contactPreference === "PHONE"} onClick={() => set("contactPreference", "PHONE")} icon="📞" label="Téléphone" disabled={!phoneAvailable} sub={!phoneAvailable ? "Vérification SMS indisponible" : undefined} />
              <Choice selected={f.contactPreference === "EMAIL"} onClick={() => set("contactPreference", "EMAIL")} icon="✉️" label="Email" disabled={!emailAvailable} sub={!emailAvailable ? "Vérification email indisponible" : undefined} />
              <Choice selected={f.contactPreference === "BOTH"} onClick={() => set("contactPreference", "BOTH")} icon="📞✉️" label="Les deux" disabled={!emailAvailable || !phoneAvailable} />
            </div>
            <Field label="Votre nom"><input className="input" value={f.contactName} onChange={(e) => set("contactName", e.target.value)} autoComplete="name" /></Field>
            {wantsEmail && <Field label="Email" hint="Un code de vérification vous sera envoyé."><input type="email" className="input" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></Field>}
            {wantsPhone && <Field label="Téléphone mobile" hint="Un code de vérification vous sera envoyé par SMS."><input type="tel" className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" placeholder="06 12 34 56 78" /></Field>}
            {wantsPhone && (
              <fieldset>
                <legend className="label">Créneaux de rappel préférés</legend>
                <div className="grid gap-2 sm:grid-cols-2">{CALLBACK_SLOTS.map((c) => <Check key={c.code} checked={f.callbackSlots.includes(c.code)} onChange={() => toggle("callbackSlots", c.code)} label={c.label} />)}</div>
              </fieldset>
            )}
            <div className="hidden" aria-hidden><label>Site web<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label></div>
          </>
        )}

        {step === 8 && (
          <>
            <h1 className="text-xl font-bold">Vérifiez votre demande</h1>
            <Summary f={f} photos={photos.length} />
            <Alert tone="info">À l&apos;étape suivante, vous vérifierez {f.contactPreference === "BOTH" ? "votre téléphone et votre email" : f.contactPreference === "PHONE" ? "votre téléphone" : "votre email"}. Rien n&apos;est diffusé avant votre validation finale.</Alert>
            {captchaSiteKey && <div className="cf-turnstile" data-sitekey={captchaSiteKey} data-callback="onBdCaptcha" data-language="fr" />}
          </>
        )}

        {step === 9 && created && (
          <>
            <h1 className="text-xl font-bold">Vérification de vos coordonnées</h1>
            <p className="text-sm text-ink-soft">Demande {created.publicRef} enregistrée en brouillon. Elle ne sera diffusée qu&apos;après vérification et votre accord.</p>
            {wantsEmail && <Verify requestId={created.id} channel="EMAIL" target={f.email} verified={verified.EMAIL} onVerified={() => setVerified((v) => ({ ...v, EMAIL: true }))} />}
            {wantsPhone && <Verify requestId={created.id} channel="PHONE" target={f.phone} verified={verified.PHONE} onVerified={() => setVerified((v) => ({ ...v, PHONE: true }))} />}
          </>
        )}

        {step === 10 && recipients && (
          <>
            <h1 className="text-xl font-bold">Destinataires de votre demande</h1>
            {recipients.length === 0 ? (
              <Alert tone="warn" title="Aucune entreprise disponible pour le moment">Aucun loueur inscrit et validé ne correspond actuellement à votre zone et à vos déchets. Votre demande n&apos;a pas été diffusée. Vous pouvez la retrouver dans votre espace de suivi.</Alert>
            ) : (
              <>
                <p className="text-sm text-ink-soft">Votre demande sera présentée, sans vos coordonnées ni votre adresse exacte, à ces {recipients.length} entreprise(s) :</p>
                <ul className="divide-y divide-black/5 rounded-3xl bg-canvas">
                  {recipients.map((r) => <li key={r.id} className="flex items-center gap-3 px-4 py-3"><span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-bold text-lime">{r.name.slice(0, 1)}</span><span className="font-semibold">{r.name}</span> <span className="text-sm text-ink-mute">· {r.city}</span></li>)}
                </ul>
                <Alert tone="info" title={`${maxUnlocks} entreprises au maximum`}>
                  Parmi elles, {maxUnlocks} entreprises au maximum pourront débloquer vos coordonnées ({f.contactPreference === "BOTH" ? "téléphone et email" : f.contactPreference === "PHONE" ? "téléphone" : "email"}) et l&apos;adresse du chantier pour vous contacter. Vous saurez lesquelles dans votre espace de suivi.
                </Alert>
                <Check checked={consent} onChange={setConsent}
                  label={`Je demande à être contacté(e) par ${f.contactPreference === "BOTH" ? "téléphone et email" : f.contactPreference === "PHONE" ? "téléphone" : "email"} au sujet de cette demande, par ${maxUnlocks} entreprises au maximum parmi celles listées ci-dessus.`} />
                <div className="rounded-3xl bg-canvas p-3">
                  <Check checked={marketing} onChange={setMarketing} label="Facultatif : j'accepte de recevoir des informations commerciales de la plateforme." hint="Indépendant de votre demande : refuser n'a aucune incidence. Aucune prospection par les loueurs n'est autorisée." />
                </div>
              </>
            )}
          </>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-between">
          {step > 0 && step < 9 ? <button type="button" className="btn-secondary" onClick={() => { setError(null); setStep((s) => s - 1); }}>Retour</button> : <span />}
          {step < 8 && <button type="button" className="btn-primary" onClick={next}>Continuer</button>}
          {step === 8 && <button type="button" className="btn-primary" disabled={busy} onClick={submit}>{busy ? "Enregistrement…" : "Valider et vérifier mes coordonnées"}</button>}
          {step === 9 && <button type="button" className="btn-primary" disabled={!allVerified || busy} onClick={loadRecipients}>{busy ? "…" : "Voir les destinataires"}</button>}
          {step === 10 && recipients && recipients.length > 0 && <button type="button" className="btn-primary" disabled={busy || !consent} onClick={publish}>{busy ? "Diffusion…" : "Recevoir des propositions"}</button>}
          {step === 10 && recipients && recipients.length === 0 && created && <Link className="btn-secondary" href={`/suivi/${created.id}`}>Mon espace de suivi</Link>}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-ink-mute">
        Service gratuit pour les demandeurs. <Link className="underline" href="/legal/confidentialite">Protection de vos données</Link>
      </p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="hint block">{hint}</span>}
    </label>
  );
}

export function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl p-1">
      <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 accent-ink" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="text-sm">{label}</span>
        {hint && <span className="block text-xs text-ink-mute">{hint}</span>}
      </span>
    </label>
  );
}

function Choice({ selected, onClick, label, sub, icon, disabled }: { selected: boolean; onClick: () => void; label: string; sub?: string; icon?: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected}
      className={`relative rounded-3xl p-4 text-left transition active:scale-[0.98] disabled:opacity-40 ${selected ? "bg-lime ring-2 ring-ink" : "bg-canvas hover:bg-lime-soft"}`}>
      {selected && <span aria-hidden className="absolute right-3 top-3 grid h-6 w-6 place-items-center rounded-full bg-ink text-xs text-lime">✓</span>}
      {icon && <span aria-hidden className="mb-2 grid h-10 w-10 place-items-center rounded-full bg-white text-xl">{icon}</span>}
      <span className="block font-bold">{label}</span>
      {sub && <span className={`mt-0.5 block text-xs ${selected ? "text-ink/70" : "text-ink-mute"}`}>{sub}</span>}
    </button>
  );
}

function Summary({ f, photos }: { f: Form; photos: number }) {
  const rows: [string, string][] = [
    ["Vous êtes", f.clientType === "PROFESSIONAL" ? `Professionnel (${f.companyName})` : "Particulier"],
    ["Adresse", `${f.addressLine}${f.addressComplement ? `, ${f.addressComplement}` : ""}, ${f.postalCode} ${f.city}`],
    ["Dates", `Pose ${f.startDate}${f.endDate ? ` · retrait ${f.endDate}` : ""}${f.flexibleDates ? " · flexibles" : ""}${f.urgent ? " · urgent" : ""}`],
    ["Déchets", f.wasteTypes.map((c) => WASTE_TYPES.find((w) => w.code === c)?.label).join(", ")],
    ["Volume", f.volumeM3 ? `${f.volumeM3} m³` : "Je ne sais pas"],
    ["Emplacement", f.placement === "PRIVATE" ? "Terrain privé" : f.placement === "PUBLIC_ROAD" ? "Voie publique" : "Je ne sais pas"],
    ["Accès", f.accessFlags.map((c) => ACCESS_FLAGS.find((a) => a.code === c)?.label).join(", ") || "Aucune contrainte signalée"],
    ["Photos", photos ? `${photos}` : "Aucune"],
    ["Contact", [f.contactName, f.contactPreference !== "PHONE" ? f.email : null, f.contactPreference !== "EMAIL" ? f.phone : null].filter(Boolean).join(" · ")],
  ];
  return (
    <dl className="divide-y divide-black/5 rounded-3xl bg-canvas text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-2 px-4 py-3"><dt className="text-ink-mute">{k}</dt><dd className="col-span-2">{v}</dd></div>
      ))}
    </dl>
  );
}

export function Verify({ requestId, channel, target, verified, onVerified }: { requestId: string; channel: "EMAIL" | "PHONE"; target: string; verified: boolean; onVerified: () => void }) {
  const [sent, setSent] = useState<null | "sent" | "dev-console">(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const label = channel === "EMAIL" ? "Email" : "Téléphone";
  if (verified) return <Alert tone="success">{label} vérifié : {target}</Alert>;
  return (
    <div className="rounded-3xl bg-canvas p-4">
      <p className="font-semibold">{label} : {target}</p>
      {!sent ? (
        <button type="button" className="btn-secondary btn-sm mt-2" disabled={busy} onClick={async () => {
          setBusy(true); setMsg(null);
          const r = await callApi<{ delivery: "sent" | "dev-console" }>(`/api/requests/${requestId}/send-code`, "POST", { channel });
          setBusy(false);
          if (!r.ok) return setMsg(r.message);
          setSent(r.data.delivery);
        }}>{busy ? "Envoi…" : `Recevoir un code par ${channel === "EMAIL" ? "email" : "SMS"}`}</button>
      ) : (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-ink-soft">{sent === "sent" ? "Code envoyé. Saisissez les 6 chiffres reçus." : "Mode développement : aucun fournisseur configuré, le code est affiché dans la console du serveur (aucun message n'a été envoyé)."}</p>
          <div className="flex gap-2">
            <input className="input max-w-[11rem] text-center text-2xl font-bold tracking-[0.3em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} aria-label="Code de vérification" />
            <button type="button" className="btn-primary" disabled={code.length !== 6 || busy} onClick={async () => {
              setBusy(true); setMsg(null);
              const r = await callApi(`/api/requests/${requestId}/verify`, "POST", { channel, code });
              setBusy(false);
              if (!r.ok) return setMsg(r.message);
              onVerified();
            }}>Vérifier</button>
          </div>
          <button type="button" className="text-sm font-semibold underline decoration-lime decoration-2 underline-offset-4" onClick={() => { setSent(null); setCode(""); }}>Renvoyer un code</button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-red-700">{msg}</p>}
    </div>
  );
}
