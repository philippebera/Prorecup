"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { callApi } from "@/lib/client-api";
import { Alert } from "@/components/ui";

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setErr(null);
      const r = await callApi<{ link: string }>("/api/loueur/team/invite", "POST", { email });
      if (!r.ok) return setErr(r.message);
      setLink(r.data.link);
      setEmail("");
      router.refresh();
    }}>
      <h2 className="font-bold">Inviter un utilisateur</h2>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input type="email" className="input" placeholder="email@entreprise.fr" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <button className="btn-primary">Inviter</button>
      </div>
      {link && <Alert tone="success">Invitation créée. Si l&apos;envoi d&apos;emails n&apos;est pas configuré, transmettez vous-même ce lien (valable 7 jours) : <code className="break-all">{link}</code></Alert>}
      {err && <Alert tone="error">{err}</Alert>}
    </form>
  );
}

export function DeleteAccountButton() {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <button className="btn-danger btn-sm" onClick={async () => {
        if (!window.confirm("Supprimer définitivement votre compte utilisateur ?")) return;
        const r = await callApi("/api/loueur/account", "DELETE", {});
        if (!r.ok) return setErr(r.message);
        router.push("/");
        router.refresh();
      }}>Supprimer mon compte</button>
      {err && <p className="mt-1 text-sm text-red-700">{err}</p>}
    </div>
  );
}
