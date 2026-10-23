"use client";

export type ApiResult<T = Record<string, unknown>> = { ok: true; data: T } | { ok: false; message: string; code?: string; issues?: { path: string; message: string }[] };

export async function callApi<T = Record<string, unknown>>(url: string, method: string, data?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: data instanceof FormData ? undefined : { "Content-Type": "application/json" },
      body: data === undefined ? undefined : data instanceof FormData ? data : JSON.stringify(data),
      credentials: "same-origin",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, message: json.message || `Erreur ${res.status}`, code: json.error, issues: json.issues };
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, message: "Connexion impossible. Vérifiez votre réseau et réessayez." };
  }
}
