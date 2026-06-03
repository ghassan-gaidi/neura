import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { respond, respondError } from '@/lib/response'
import crypto from 'crypto'

/**
 * POST /api/auth/create-key
 * Create a new API key for the authenticated user.
 * Requires Supabase Auth Bearer token.
 * Body: { label?: string }
 * Returns the raw key once (won't be shown again).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return respondError('unauthorized', 'Missing authorization header', 401)
    }

    const token = authHeader.slice(7)

    // Verify Supabase Auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return respondError('unauthorized', 'Invalid or expired token', 401)
    }

    // Get user's tenant_id
    const { data: profile } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return respondError('not_found', 'User profile not found', 404)
    }

    const body = await request.json().catch(() => ({}))
    const label = body.label || `key-${Date.now()}`

    // Generate API key
    const rawKey = `sk-${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: profile.tenant_id,
        key_hash: keyHash,
        label,
      })
      .select('id, label, is_active, created_at')
      .single()

    if (error) {
      return respondError('internal_error', 'Failed to create key: ' + error.message, 500)
    }

    return respond({ ...data, raw_key: rawKey }, 201)
  } catch (err: any) {
    console.error('POST /api/auth/create-key error:', err)
    return respondError('internal_error', err.message, 500)
  }
}
