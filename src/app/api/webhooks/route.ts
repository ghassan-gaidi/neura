import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'

/**
 * POST /api/webhooks
 * Register a webhook for event notifications.
 * Body: { url, events, secret? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const body = await request.json().catch(() => ({}))
    if (!body.url || typeof body.url !== 'string') {
      return respondError('validation_error', 'url is required and must be a string', 400)
    }
    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      return respondError('validation_error', 'events must be a non-empty array', 400)
    }

    const validEvents = ['memory.created', 'memory.updated', 'memory.deleted', 'memory.expiring', 'state.changed', 'memory.shared', 'credits.low']
    const invalid = body.events.filter((e: string) => !validEvents.includes(e))
    if (invalid.length > 0) {
      return respondError('validation_error', `Invalid event(s): ${invalid.join(', ')}`, 400)
    }

    const { data, error } = await supabase
      .from('webhooks')
      .insert({
        tenant_id: auth.tenantId,
        url: body.url,
        events: body.events,
        secret: body.secret || null,
      })
      .select('id, url, events, is_active, created_at')
      .single()

    if (error) {
      return respondError('internal_error', 'Failed to register webhook: ' + error.message, 500)
    }

    logUsage(auth, 'POST /api/webhooks')
    return respond(data, 201)
  } catch (err: any) {
    console.error('POST /api/webhooks error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * GET /api/webhooks
 * List all registered webhooks for this tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { data, error } = await supabase
      .from('webhooks')
      .select('id, url, events, is_active, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })

    if (error) {
      return respondError('internal_error', 'Failed to list webhooks: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/webhooks')
    return respond(data || [], 200)
  } catch (err: any) {
    console.error('GET /api/webhooks error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
