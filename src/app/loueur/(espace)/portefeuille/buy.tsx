"use client";

import { useState } from "react";
import { callApi } from "@/lib/client-api";

export function BuyPackButton({ packId, disabled }: { packId: string; disabled: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button className="btn-primary w-full" disabled={disabled || busy} onClick={async () => {
        setBusy(true);
        setErr(null);
        const r = await callApi<{ url: string }>("/api/loueur/checkout", "POST", { packId });
        if (!r.ok) {
          setBusy(false);
          return setErr(r.message);
        }
        window.location.href = r.data.url;
      }}>{busy ? "Redirection vers le paiement…" : "Acheter"}</button>
      {err && <p className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  );
}
