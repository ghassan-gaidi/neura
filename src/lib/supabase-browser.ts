import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

let _browserClient: SupabaseClient | null = null

/**
 * Browser-side Supabase client for auth (magic links).
 * Uses anon key — RLS protects user data.
 * Lazy-initialized to avoid build failures.
 */
export function getSupabaseBrowser(): SupabaseClient {
  if (!_browserClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase public credentials not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
    }

    _browserClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  }
  return _browserClient
}

/** @deprecated Use getSupabaseBrowser() instead — keep for backward compat */
export const supabaseBrowser = new Proxy({} as SupabaseClient, {
  get(_, prop) {
    const client = getSupabaseBrowser()
    return (client as any)[prop]
  },
})
