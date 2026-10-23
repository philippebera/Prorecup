import { describe, expect, it } from 'vitest'
import { readEnv } from './env'

describe('readEnv', () => {
  it('retourne null si une variable obligatoire manque', () => {
    expect(readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBeNull()
    expect(readEnv({ VITE_SUPABASE_ANON_KEY: 'k' })).toBeNull()
  })

  it('normalise l’URL et rend la clé VAPID facultative', () => {
    expect(
      readEnv({ VITE_SUPABASE_URL: 'https://x.supabase.co/', VITE_SUPABASE_ANON_KEY: ' k ' }),
    ).toEqual({
      supabaseUrl: 'https://x.supabase.co',
      supabaseAnonKey: 'k',
      vapidPublicKey: '',
    })
  })
})
