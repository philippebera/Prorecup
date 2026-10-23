export interface AppEnv {
  supabaseUrl: string
  supabaseAnonKey: string
  vapidPublicKey: string
}

/** Lit et valide les variables publiques. Pure : reçoit l'objet `import.meta.env`. */
export function readEnv(raw: Record<string, string | undefined>): AppEnv | null {
  const supabaseUrl = raw.VITE_SUPABASE_URL?.trim()
  const supabaseAnonKey = raw.VITE_SUPABASE_ANON_KEY?.trim()
  if (!supabaseUrl || !supabaseAnonKey) return null
  return {
    supabaseUrl: supabaseUrl.replace(/\/+$/, ''),
    supabaseAnonKey,
    vapidPublicKey: raw.VITE_VAPID_PUBLIC_KEY?.trim() ?? '',
  }
}

export const env = readEnv(import.meta.env as Record<string, string | undefined>)
