import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'

/**
 * GET /api/state/[key]
 * Retrieve a single state value by key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, {
        retry_after: Math.ceil(rl.resetMs / 1000),
      })
    }

    const { key } = await params
    if (!key) return respondError('validation_error', 'State key is required', 400)

    const { data, error } = await supabase
      .from('state_store')
      .select('key, value, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .eq('key', key)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return respondError('not_found', `State key "${key}" not found`, 404)
      }
      return respondError('internal_error', 'Failed to fetch state: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/state/:key')
    return respond(data, 200)
  } catch (err: any) {
    console.error('GET /api/state/:key error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * DELETE /api/state/[key]
 * Remove a state entry.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, {
        retry_after: Math.ceil(rl.resetMs / 1000),
      })
    }

    const { key } = await params
    if (!key) return respondError('validation_error', 'State key is required', 400)

    const { data, error } = await supabase
      .from('state_store')
      .delete()
      .eq('tenant_id', auth.tenantId)
      .eq('key', key)
      .select('key')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return respondError('not_found', `State key "${key}" not found`, 404)
      }
      return respondError('internal_error', 'Delete failed: ' + error.message, 500)
    }

    return respond({ key, deleted: true }, 200)
  } catch (err: any) {
    console.error('DELETE /api/state/:key error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
