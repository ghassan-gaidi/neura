import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit, withIdempotency } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { UpsertStateRequest, AuthContext } from '@/lib/types'

/**
 * POST /api/state
 * Upsert a key-value state entry. Supports Idempotency-Key.
 * Body: { key, value }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    return await withIdempotency(async (req: NextRequest, auth: AuthContext) => {
      const rl = checkRateLimit(auth.apiKeyId)
      if (!rl.allowed) {
        return respondError('rate_limited', 'Rate limit exceeded', 429, {
          retry_after: Math.ceil(rl.resetMs / 1000),
        })
      }

      const body: UpsertStateRequest = await req.json().catch(() => ({}))
      if (!body.key || typeof body.key !== 'string') {
        return respondError('validation_error', 'key is required and must be a string', 400)
      }
      if (body.value === undefined) {
        return respondError('validation_error', 'value is required', 400)
      }

      const { data, error } = await supabase
        .from('state_store')
        .upsert(
          { tenant_id: auth.tenantId, key: body.key, value: body.value },
          { onConflict: 'tenant_id, key', ignoreDuplicates: false }
        )
        .select('key, value, created_at, updated_at')
        .single()

      if (error) {
        return respondError('internal_error', 'State update failed: ' + error.message, 500)
      }

      logUsage(auth, 'POST /api/state')
      return respond(data, 201)
    })(request, auth)
  } catch (err: any) {
    console.error('POST /api/state error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * GET /api/state
 * Retrieve all state keys for this tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, {
        retry_after: Math.ceil(rl.resetMs / 1000),
      })
    }

    const { data, error } = await supabase
      .from('state_store')
      .select('key, value, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .order('key', { ascending: true })

    if (error) {
      return respondError('internal_error', 'Failed to fetch state: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/state')
    return respond(data || [], 200, { total: data?.length || 0 })
  } catch (err: any) {
    console.error('GET /api/state error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
