import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { fireWebhook } from '@/lib/webhooks'

/**
 * POST /api/memory/:id/share
 * Share a memory with another agent by their tenant_id.
 * Body: { target_tenant_id, permission? ('read' | 'write') }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { id } = await params
    if (!id) return respondError('validation_error', 'Memory ID is required', 400)

    // Verify the memory exists and belongs to this tenant
    const { data: memory, error: memErr } = await supabase
      .from('memories')
      .select('id, content')
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .single()

    if (memErr || !memory) {
      return respondError('not_found', 'Memory not found', 404)
    }

    const body = await request.json().catch(() => ({}))
    if (!body.target_tenant_id) {
      return respondError('validation_error', 'target_tenant_id is required', 400)
    }

    const permission = body.permission || 'read'
    if (!['read', 'write'].includes(permission)) {
      return respondError('validation_error', 'permission must be "read" or "write"', 400)
    }

    const { data, error } = await supabase
      .from('shared_memories')
      .upsert(
        {
          memory_id: id,
          owner_tenant_id: auth.tenantId,
          target_tenant_id: body.target_tenant_id,
          permission,
        },
        { onConflict: 'memory_id, target_tenant_id', ignoreDuplicates: false }
      )
      .select('id, memory_id, target_tenant_id, permission, created_at')
      .single()

    if (error) {
      return respondError('internal_error', 'Failed to share memory: ' + error.message, 500)
    }

    // Fire webhook
    fireWebhook(auth.tenantId, 'memory.shared', {
      memory_id: id,
      shared_with: body.target_tenant_id,
      permission,
    })

    logUsage(auth, 'POST /api/memory/:id/share')
    return respond(data, 201)
  } catch (err: any) {
    console.error('POST /api/memory/:id/share error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * GET /api/memory/:id/share
 * List who this memory is shared with.
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
    if (!id) return respondError('validation_error', 'Memory ID is required', 400)

    const { data, error } = await supabase
      .from('shared_memories')
      .select('id, target_tenant_id, permission, created_at')
      .eq('memory_id', id)
      .eq('owner_tenant_id', auth.tenantId)

    if (error) {
      return respondError('internal_error', 'Failed to list shares: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/memory/:id/share')
    return respond(data || [], 200)
  } catch (err: any) {
    console.error('GET /api/memory/:id/share error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * DELETE /api/memory/:id/share?target=...
 * Remove sharing with a specific tenant.
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
    const target = request.nextUrl.searchParams.get('target')
    if (!id || !target) {
      return respondError('validation_error', 'Memory ID and target tenant_id are required', 400)
    }

    const { data, error } = await supabase
      .from('shared_memories')
      .delete()
      .eq('memory_id', id)
      .eq('owner_tenant_id', auth.tenantId)
      .eq('target_tenant_id', target)
      .select('id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') return respondError('not_found', 'Share not found', 404)
      return respondError('internal_error', 'Failed to remove share: ' + error.message, 500)
    }

    logUsage(auth, 'DELETE /api/memory/:id/share')
    return respond({ memory_id: id, target_tenant_id: target, deleted: true }, 200)
  } catch (err: any) {
    console.error('DELETE /api/memory/:id/share error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
