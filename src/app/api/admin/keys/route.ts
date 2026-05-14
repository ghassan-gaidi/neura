import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { respond, respondError } from '@/lib/response'
import crypto from 'crypto'

/**
 * POST /api/admin/keys
 * Generate a new API key for the current tenant.
 * Body: { label?: string }
 * Returns the raw key once (it won't be shown again).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const body = await request.json().catch(() => ({}))
    const label = body.label || `key-${Date.now()}`

    // Generate a random API key
    const rawKey = `sk-${crypto.randomBytes(32).toString('hex')}`
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        tenant_id: auth.tenantId,
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
    console.error('POST /api/admin/keys error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * GET /api/admin/keys
 * List all API keys for this tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, label, is_active, created_at, last_used_at')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      return respondError('internal_error', 'Failed to list keys: ' + error.message, 500)
    }

    return respond(data || [], 200)
  } catch (err: any) {
    console.error('GET /api/admin/keys error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
