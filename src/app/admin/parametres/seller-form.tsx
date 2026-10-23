"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";

const FIELDS: [string, string][] = [
  ["legalName", "Raison sociale"], ["legalForm", "Forme juridique"], ["address", "Adresse du siège"], ["siret", "SIRET"],
  ["vatNumber", "N° TVA intracommunautaire"], ["rcs", "RCS (ville et numéro)"], ["capital", "Capital social"], ["email", "Email de facturation"],
];

export function SellerJsonForm({ seller }: { seller: Record<string, string> }) {
  const router = useRouter();
  const [v, setV] = useState(seller);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  return (
    <form className="space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi("/api/admin/settings", "PUT", { seller: v });
      setMsg(r.ok ? { tone: "success", text: "Identité enregistrée. Les nouvelles factures utiliseront ces informations." } : { tone: "error", text: r.message });
      router.refresh();
    }}>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([k, l]) => (
          <label key={k} className="block"><span className="label">{l}</span><input className="input" value={v[k] ?? ""} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></label>
        ))}
      </div>
      <button className="btn-primary btn-sm">Enregistrer</button>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </form>
  );
}
