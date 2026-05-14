import { supabase } from './supabase'
import { AuthContext } from './types'
import crypto from 'crypto'
import { NextResponse } from 'next/server'

/**
 * Auth cache: avoids DB lookup on every request for the same key.
 * In production, swap to Redis/Vercel KV.
 */
const authCache = new Map<string, { tenantId: string; apiKeyId: string; cachedAt: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

/**
 * Resolve a Bearer token to a tenant context.
 * The raw key is SHA-256 hashed, then looked up in the api_keys table.
 */
export async function resolveApiKey(request: Request): Promise<AuthContext | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null
  }

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) return null

  // Check cache first
  const cached = authCache.get(rawKey)
  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return { tenantId: cached.tenantId, apiKeyId: cached.apiKeyId }
  }

  // Hash the key and look up in DB
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, tenant_id, is_active')
    .eq('key_hash', keyHash)
    .single()

  if (error || !data || !data.is_active) {
    return null
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then()

  const result = { tenantId: data.tenant_id, apiKeyId: data.id }

  // Cache it
  authCache.set(rawKey, { ...result, cachedAt: Date.now() })

  return result
}

/**
 * Require auth — returns null auth response or the validated context.
 */
export async function requireAuth(request: Request): Promise<AuthContext | NextResponse> {
  // Import here to avoid circular deps
  const { unauthorized } = await import('./errors')
  const auth = await resolveApiKey(request)
  if (!auth) {
    return unauthorized() as any
  }
  return auth
}
