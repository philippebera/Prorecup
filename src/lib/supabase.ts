import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from './env'

/**
 * Client Supabase du navigateur. La couche `data/` ne l'importe jamais directement :
 * il lui est injecté (compatibilité future Expo, stockage de session différent).
 */
export const supabase: SupabaseClient | null = env
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    })
  : null
