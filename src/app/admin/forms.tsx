"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";

function useSubmit() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (url: string, method: string, data: unknown, success = "Enregistré.") => {
    setBusy(true);
    setMsg(null);
    const r = await callApi(url, method, data);
    setBusy(false);
    setMsg(r.ok ? { tone: "success", text: success } : { tone: "error", text: r.issues?.[0] ? `${r.issues[0].path} : ${r.issues[0].message}` : r.message });
    if (r.ok) router.refresh();
    return r.ok;
  };
  return { msg, busy, run };
}

export function CompanyActions({ companyId, status }: { companyId: string; status: string }) {
  const { msg, busy, run } = useSubmit();
  const [grant, setGrant] = useState(true);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status !== "APPROVED" && (
          <>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={grant} onChange={(e) => setGrant(e.target.checked)} />Attribuer les crédits de découverte (si jamais attribués à ce SIREN)</label>
            <button className="btn-primary btn-sm" disabled={busy} onClick={() => run(`/api/admin/companies/${companyId}`, "POST", { action: "approve", grantWelcome: grant }, "Entreprise validée.")}>Valider</button>
          </>
        )}
        {status !== "SUSPENDED" && <button className="btn-danger btn-sm" disabled={busy} onClick={() => { const reason = prompt("Motif de suspension ?"); if (reason) run(`/api/admin/companies/${companyId}`, "POST", { action: "suspend", reason }); }}>Suspendre</button>}
        {status === "PENDING" && <button className="btn-danger btn-sm" disabled={busy} onClick={() => { const reason = prompt("Motif du refus ?"); if (reason) run(`/api/admin/companies/${companyId}`, "POST", { action: "reject", reason }); }}>Refuser</button>}
        {status === "SUSPENDED" && <button className="btn-secondary btn-sm" disabled={busy} onClick={() => run(`/api/admin/companies/${companyId}`, "POST", { action: "approve", grantWelcome: false }, "Entreprise réactivée.")}>Réactiver</button>}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

export function VerifyFieldForm({ companyId }: { companyId: string }) {
  const { msg, busy, run } = useSubmit();
  const [field, setField] = useState("SIRET");
  const [method, setMethod] = useState("");
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(`/api/admin/companies/${companyId}`, "POST", { action: "verify", field, method }, "Vérification enregistrée."); }}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select className="input sm:w-48" value={field} onChange={(e) => setField(e.target.value)}>
          {["SIRET", "IDENTITY", "PHONE", "EMAIL", "ADDRESS", "INSURANCE", "WASTE_PERMITS"].map((f) => <option key={f}>{f}</option>)}
        </select>
        <input className="input" placeholder="Méthode (ex. : annuaire des entreprises consulté, appel au standard)" value={method} onChange={(e) => setMethod(e.target.value)} required minLength={3} />
        <button className="btn-secondary btn-sm" disabled={busy}>Marquer vérifié</button>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}

export function AdjustCreditsForm({ companyId }: { companyId: string }) {
  const { msg, busy, run } = useSubmit();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [key] = useState(() => crypto.randomUUID());
  return (
    <form className="space-y-2" onSubmit={async (e) => {
      e.preventDefault();
      if (!confirm(`Ajuster de ${amount} crédit(s) ?`)) return;
      await run("/api/admin/credits", "POST", { companyId, amount: Number(amount), reason, idempotencyKey: `${key}-${amount}` }, "Ajustement enregistré.");
    }}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className="input sm:w-32" type="number" placeholder="+/- crédits" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        <input className="input" placeholder="Motif obligatoire" value={reason} onChange={(e) => setReason(e.target.value)} required minLength={5} />
        <button className="btn-secondary btn-sm" disabled={busy}>Ajuster</button>
      </div>
      <p className="text-xs text-ink-mute">Ajustement tracé dans le registre et le journal d&apos;audit. Pour une réclamation, utilisez plutôt la restitution depuis « Signalements ».</p>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}

export function ResolveClaimForm({ claimId }: { claimId: string }) {
  const { msg, busy, run } = useSubmit();
  const [resolution, setResolution] = useState("");
  return (
    <div className="space-y-2">
      <textarea className="input" rows={2} placeholder="Justification (obligatoire, visible par le loueur)" value={resolution} onChange={(e) => setResolution(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary btn-sm" disabled={busy || resolution.length < 5} onClick={() => run(`/api/admin/claims/${claimId}`, "POST", { accept: true, resolution }, "Crédit restitué.")}>Restituer 1 crédit</button>
        <button className="btn-secondary btn-sm" disabled={busy || resolution.length < 5} onClick={() => run(`/api/admin/claims/${claimId}`, "POST", { accept: false, resolution }, "Signalement refusé.")}>Refuser</button>
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const { msg, busy, run } = useSubmit();
  const [resolution, setResolution] = useState("");
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input className="input" placeholder="Suite donnée" value={resolution} onChange={(e) => setResolution(e.target.value)} />
      <button className="btn-secondary btn-sm" disabled={busy || resolution.length < 3} onClick={() => run(`/api/admin/reports/${reportId}`, "POST", { resolution })}>Clore</button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

export function PurchaseReviewForm({ purchaseId, refundable }: { purchaseId: string; refundable: boolean }) {
  const { msg, busy, run } = useSubmit();
  const [note, setNote] = useState("");
  return (
    <div className="space-y-2">
      <input className="input" placeholder="Note d'examen / motif" value={note} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary btn-sm" disabled={busy || note.length < 5} onClick={() => run(`/api/admin/purchases/${purchaseId}`, "POST", { action: "resolve-review", note })}>Clore l&apos;examen</button>
        {refundable && <button className="btn-danger btn-sm" disabled={busy || note.length < 5} onClick={() => confirm("Rembourser intégralement ce pack via Stripe ? Les crédits seront annulés à réception du webhook, dans la limite du solde.") && run(`/api/admin/purchases/${purchaseId}`, "POST", { action: "refund", reason: note }, "Remboursement demandé à Stripe.")}>Rembourser le pack (Stripe)</button>}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

export function JsonForm({ url, method = "POST", fields, initial, submitLabel = "Enregistrer" }: {
  url: string; method?: string; submitLabel?: string; initial: Record<string, unknown>;
  fields: { name: string; label: string; type?: "text" | "number" | "checkbox" | "textarea" | "list" | "select"; options?: string[]; hint?: string }[];
}) {
  const { msg, busy, run } = useSubmit();
  const [v, setV] = useState<Record<string, unknown>>(initial);
  return (
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault();
      const out: Record<string, unknown> = { ...v };
      for (const f of fields) {
        if (f.type === "number") out[f.name] = Number(v[f.name]);
        if (f.type === "list") out[f.name] = String(v[f.name] ?? "").split(/[\s,;]+/).filter(Boolean);
      }
      run(url, method, out);
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.name} className={f.type === "textarea" ? "block sm:col-span-2" : f.type === "checkbox" ? "flex items-center gap-2 text-sm" : "block"}>
            {f.type === "checkbox" ? (
              <><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={Boolean(v[f.name])} onChange={(e) => setV({ ...v, [f.name]: e.target.checked })} />{f.label}</>
            ) : (
              <>
                <span className="label">{f.label}</span>
                {f.type === "textarea" ? <textarea className="input" rows={3} value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />
                  : f.type === "select" ? <select className="input" value={String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })}>{f.options!.map((o) => <option key={o}>{o}</option>)}</select>
                  : <input className="input" type={f.type === "number" ? "number" : "text"} value={Array.isArray(v[f.name]) ? (v[f.name] as string[]).join(", ") : String(v[f.name] ?? "")} onChange={(e) => setV({ ...v, [f.name]: e.target.value })} />}
                {f.hint && <span className="hint block">{f.hint}</span>}
              </>
            )}
          </label>
        ))}
      </div>
      <button className="btn-primary btn-sm" disabled={busy}>{submitLabel}</button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}
