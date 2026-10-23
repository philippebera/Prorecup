"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";

export function UnlockPanel({ requestId, available, approved, balance, warning, packs }: {
  requestId: string; available: boolean; approved: boolean; balance: number; warning: string; packs: { id: string; name: string; credits: number }[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!approved) return <div className="card"><Alert tone="warn">Votre entreprise doit être validée avant de débloquer des contacts.</Alert></div>;
  if (!available) return <div className="card"><Alert tone="info">Cette demande n&apos;est plus disponible (clôturée, suspendue par le client ou places déjà attribuées).</Alert></div>;

  async function buy(packId: string) {
    setBusy(true);
    const r = await callApi<{ url: string }>("/api/loueur/checkout", "POST", { packId, returnTo: `/loueur/demandes/${requestId}` });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    window.location.href = r.data.url;
  }

  return (
    <div className="card-dark space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Obtenir les coordonnées</h2>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">Solde <span className="text-lime">{balance}</span></span>
      </div>
      {balance < 1 ? (
        <>
          <Alert tone="warn">Solde insuffisant. Achetez un pack : le contact ne sera pas débloqué automatiquement, une nouvelle confirmation vous sera demandée.</Alert>
          <div className="flex flex-col gap-2">
            {packs.map((p) => <button key={p.id} className="btn bg-white/10 text-white hover:bg-white/15" disabled={busy} onClick={() => buy(p.id)}>{p.name}</button>)}
          </div>
          <a className="text-sm font-semibold text-lime underline underline-offset-4" href="/loueur/portefeuille">Voir les prix HT et TTC</a>
        </>
      ) : !confirming ? (
        <button className="flex w-full items-center justify-between rounded-full bg-lime py-2.5 pl-5 pr-2.5 font-bold text-ink transition hover:bg-lime-dark active:scale-[0.98]" onClick={() => setConfirming(true)}>
          Débloquer ce contact
          <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full bg-ink text-lime">→</span>
        </button>
      ) : (
        <div role="dialog" aria-modal="false" aria-labelledby="unlock-title" className="space-y-3 rounded-3xl bg-white p-4 text-ink">
          <p id="unlock-title" className="font-semibold">{warning}</p>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy} onClick={async () => {
              setBusy(true);
              setError(null);
              const r = await callApi(`/api/loueur/requests/${requestId}/unlock`, "POST", { confirmed: true });
              setBusy(false);
              if (!r.ok) return setError(r.message);
              router.refresh();
            }}>{busy ? "…" : "Confirmer (1 crédit)"}</button>
            <button className="btn-secondary" onClick={() => setConfirming(false)}>Annuler</button>
          </div>
        </div>
      )}
      {error && <Alert tone="error">{error}</Alert>}
    </div>
  );
}

export function ClaimForm({ unlockId, reasons }: { unlockId: string; reasons: { code: string; label: string }[] }) {
  const router = useRouter();
  const [reason, setReason] = useState(reasons[0].code);
  const [details, setDetails] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="mt-3 space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi("/api/loueur/claims", "POST", { unlockId, reason, details });
      if (!r.ok) return setErr(r.message);
      router.refresh();
    }}>
      <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
        {reasons.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
      </select>
      <textarea className="input" rows={3} required minLength={10} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Décrivez précisément le problème (tentatives d'appel, messages d'erreur…)" />
      <button className="btn-secondary btn-sm">Envoyer le signalement</button>
      {err && <Alert tone="error">{err}</Alert>}
    </form>
  );
}

const cents = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(",", ".")) * 100));

export function OfferForm({ requestId, defaultVolume }: { requestId: string; defaultVolume: number | null }) {
  const router = useRouter();
  const inTwoWeeks = new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10);
  const [f, setF] = useState({
    volumeM3: String(defaultVolume ?? 8), wasteAllowed: "", wasteExcluded: "Amiante, déchets dangereux, plâtre", includesDelivery: true, includesTransport: true, includesPickup: true,
    includedDays: "7", weightMode: "INCLUDED", includedTonnes: "", pricePerTonne: "", pricePerExtraDay: "", otherFees: "", amountHt: "", vatRateBp: "2000",
    proposedAvailability: "", validUntil: inTwoWeeks, message: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);
  const set = (k: keyof typeof f, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));
  const ht = cents(f.amountHt) ?? 0;
  const vat = Math.round((ht * Number(f.vatRateBp)) / 10000);

  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setErr(null);
      const r = await callApi(`/api/loueur/requests/${requestId}/offers`, "POST", {
        volumeM3: Number(f.volumeM3), wasteAllowed: f.wasteAllowed, wasteExcluded: f.wasteExcluded,
        includesDelivery: f.includesDelivery, includesTransport: f.includesTransport, includesPickup: f.includesPickup,
        includedDays: Number(f.includedDays), weightMode: f.weightMode, includedTonnes: f.weightMode === "INCLUDED" && f.includedTonnes ? Number(f.includedTonnes.replace(",", ".")) : null,
        pricePerTonneCents: cents(f.pricePerTonne), pricePerExtraDayCents: cents(f.pricePerExtraDay), otherFees: f.otherFees || null,
        amountHtCents: ht, vatRateBp: Number(f.vatRateBp), proposedAvailability: f.proposedAvailability, validUntil: f.validUntil, message: f.message || null,
      });
      if (!r.ok) return setErr(r.message);
      setOkMsg(true);
      router.refresh();
    }}>
      <h3 className="font-bold">Envoyer une offre</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">Volume (m³)</span><input className="input" type="number" min={1} value={f.volumeM3} onChange={(e) => set("volumeM3", e.target.value)} required /></label>
        <label><span className="label">Jours inclus</span><input className="input" type="number" min={1} value={f.includedDays} onChange={(e) => set("includedDays", e.target.value)} required /></label>
        <label><span className="label">Validité jusqu&apos;au</span><input className="input" type="date" value={f.validUntil} onChange={(e) => set("validUntil", e.target.value)} required /></label>
      </div>
      <label className="block"><span className="label">Déchets autorisés</span><input className="input" value={f.wasteAllowed} onChange={(e) => set("wasteAllowed", e.target.value)} required /></label>
      <label className="block"><span className="label">Déchets exclus</span><input className="input" value={f.wasteExcluded} onChange={(e) => set("wasteExcluded", e.target.value)} required /></label>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="label">Inclus dans le prix</legend>
        {([["includesDelivery", "Pose"], ["includesTransport", "Transport"], ["includesPickup", "Retrait"]] as const).map(([k, l]) => (
          <label key={k} className="flex items-center gap-2"><input type="checkbox" className="h-5 w-5 accent-ink" checked={f[k] as boolean} onChange={(e) => set(k, e.target.checked)} />{l}</label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">Poids</span>
          <select className="input" value={f.weightMode} onChange={(e) => set("weightMode", e.target.value)}>
            <option value="INCLUDED">Poids inclus</option>
            <option value="ACTUAL">Facturation au réel</option>
          </select>
        </label>
        {f.weightMode === "INCLUDED" && <label><span className="label">Tonnes incluses</span><input className="input" inputMode="decimal" value={f.includedTonnes} onChange={(e) => set("includedTonnes", e.target.value)} required /></label>}
        <label><span className="label">Prix / tonne supp. (€ HT)</span><input className="input" inputMode="decimal" value={f.pricePerTonne} onChange={(e) => set("pricePerTonne", e.target.value)} /></label>
        <label><span className="label">Prix / jour supp. (€ HT)</span><input className="input" inputMode="decimal" value={f.pricePerExtraDay} onChange={(e) => set("pricePerExtraDay", e.target.value)} /></label>
      </div>
      <label className="block"><span className="label">Autres suppléments</span><input className="input" value={f.otherFees} onChange={(e) => set("otherFees", e.target.value)} placeholder="Ex. : attente, déchets non conformes…" /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label><span className="label">Montant (€ HT)</span><input className="input" inputMode="decimal" value={f.amountHt} onChange={(e) => set("amountHt", e.target.value)} required /></label>
        <label><span className="label">TVA</span>
          <select className="input" value={f.vatRateBp} onChange={(e) => set("vatRateBp", e.target.value)}>
            <option value="2000">20 %</option><option value="1000">10 %</option><option value="550">5,5 %</option><option value="0">0 % (non applicable)</option>
          </select>
        </label>
        <div><span className="label">Total TTC</span><p className="py-2.5 text-lg font-bold">{((ht + vat) / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p></div>
      </div>
      <label className="block"><span className="label">Disponibilité proposée</span><input className="input" value={f.proposedAvailability} onChange={(e) => set("proposedAvailability", e.target.value)} placeholder="Ex. : pose possible à partir du 12 novembre" required /></label>
      <label className="block"><span className="label">Message (facultatif)</span><textarea className="input" rows={3} value={f.message} onChange={(e) => set("message", e.target.value)} /></label>
      <p className="text-xs text-ink-mute">Le taux de TVA applicable relève de votre responsabilité. Le poids final n&apos;a aucune incidence sur le coût du contact.</p>
      <button className="btn-primary">Envoyer l&apos;offre au client</button>
      {err && <Alert tone="error">{err}</Alert>}
      {okMsg && <Alert tone="success">Offre enregistrée et visible par le client dans son espace.</Alert>}
    </form>
  );
}
