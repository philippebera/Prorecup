"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { callApi } from "@/lib/client-api";
import { Alert } from "./ui";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      const r = await callApi<{ redirect: string }>("/api/auth/login", "POST", { email, password });
      setBusy(false);
      if (!r.ok) return setErr(r.message);
      router.push(next && next.startsWith("/") && !next.startsWith("//") ? next : r.data.redirect);
      router.refresh();
    }}>
      <label className="block"><span className="label">Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></label>
      <label className="block"><span className="label">Mot de passe</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" /></label>
      <button className="btn-primary w-full" disabled={busy}>{busy ? "…" : "Se connecter"}</button>
      {err && <Alert tone="error">{err}</Alert>}
      <p className="text-center text-sm"><Link className="text-brand-700" href="/mot-de-passe/oublie">Mot de passe oublié ?</Link></p>
    </form>
  );
}

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi<{ message: string }>("/api/auth/reset-request", "POST", { email });
      setMsg(r.ok ? r.data.message : r.message);
    }}>
      <label className="block"><span className="label">Email du compte</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <button className="btn-primary">Recevoir un lien</button>
      {msg && <Alert tone="info">{msg}</Alert>}
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi("/api/auth/reset", "POST", { token, password });
      if (!r.ok) return setErr(r.message);
      router.push("/connexion?reinitialise=1");
    }}>
      <label className="block"><span className="label">Nouveau mot de passe (10 caractères min.)</span><input className="input" type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></label>
      <button className="btn-primary">Enregistrer</button>
      {err && <Alert tone="error">{err}</Alert>}
    </form>
  );
}

export function InvitationForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  return (
    <form className="card space-y-3" onSubmit={async (e) => {
      e.preventDefault();
      const r = await callApi<{ redirect: string }>("/api/invitation", "POST", { token, name, password });
      if (!r.ok) return setErr(r.message);
      router.push(r.data.redirect);
      router.refresh();
    }}>
      <label className="block"><span className="label">Nom et prénom</span><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></label>
      <label className="block"><span className="label">Mot de passe (10 caractères min.)</span><input className="input" type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" /></label>
      <button className="btn-primary">Rejoindre l&apos;entreprise</button>
      {err && <Alert tone="error">{err}</Alert>}
    </form>
  );
}
