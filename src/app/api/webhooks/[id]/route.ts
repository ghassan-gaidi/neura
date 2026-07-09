import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'

/**
 * GET /api/webhooks/[id]
 * Get a specific webhook by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { id } = await params
    if (!id) return respondError('validation_error', 'Webhook ID is required', 400)

    const { data, error } = await supabase
      .from('webhooks')
      .select('id, url, events, is_active, secret, created_at, updated_at')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return respondError('not_found', 'Webhook not found', 404)
      return respondError('internal_error', 'Failed to get webhook: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/webhooks/:id')
    return respond(data, 200)
  } catch (err: any) {
    console.error('GET /api/webhooks/:id error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * PATCH /api/webhooks/[id]
 * Update a webhook's URL, events, or active status.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { id } = await params
    if (!id) return respondError('validation_error', 'Webhook ID is required', 400)

    const body = await request.json().catch(() => ({}))
    if (!body.url && !body.events && body.is_active === undefined && !body.secret) {
      return respondError('validation_error', 'At least one field to update is required', 400)
    }

    const updates: Record<string, unknown> = {}
    if (body.url) {
      // Validate URL format and protocol
      try {
        const parsed = new URL(body.url)
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          return respondError('validation_error', 'url must use http or https protocol', 400)
        }
      } catch {
        return respondError('validation_error', 'url must be a valid URL', 400)
      }
      updates.url = body.url
    }
    if (body.events) updates.events = body.events
    if (body.is_active !== undefined) updates.is_active = body.is_active
    if (body.secret !== undefined) updates.secret = body.secret

    const { data, error } = await supabase
      .from('webhooks')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select('id, url, events, is_active, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return respondError('not_found', 'Webhook not found', 404)
      return respondError('internal_error', 'Failed to update webhook: ' + error.message, 500)
    }

    logUsage(auth, 'PATCH /api/webhooks/:id')
    return respond(data, 200)
  } catch (err: any) {
    console.error('PATCH /api/webhooks/:id error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * DELETE /api/webhooks/[id]
 * Remove a webhook.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { id } = await params
    if (!id) return respondError('validation_error', 'Webhook ID is required', 400)

    const { data, error } = await supabase
      .from('webhooks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select('id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return respondError('not_found', 'Webhook not found', 404)
      return respondError('internal_error', 'Failed to delete webhook: ' + error.message, 500)
    }

    logUsage(auth, 'DELETE /api/webhooks/:id')
    return respond({ id, deleted: true }, 200)
  } catch (err: any) {
    console.error('DELETE /api/webhooks/:id error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
