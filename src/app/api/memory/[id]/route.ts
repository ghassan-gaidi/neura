import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { AuthContext } from '@/lib/types'
import { fireWebhook } from '@/lib/webhooks'
import { checkCredits, deductCredits, buildX402Response } from '@/lib/credits'
import { NextResponse } from 'next/server'

/**
 * DELETE /api/memory/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    if (!id) return respondError('validation_error', 'Memory ID is required', 400)

    const { data, error } = await supabase
      .from('memories')
      .delete()
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select('id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return respondError('not_found', 'Memory not found', 404)
      }
      return respondError('internal_error', 'Delete failed: ' + error.message, 500)
    }

    fireWebhook(auth.tenantId, 'memory.deleted', { memory_id: id })
    return respond({ id, deleted: true }, 200)
  } catch (err: any) {
    console.error('DELETE /api/memory error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * PATCH /api/memory/[id]
 * Update a memory. If content changes, embedding is regenerated.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params
    if (!id) return respondError('validation_error', 'Memory ID is required', 400)

    // Credits check — 1 credit for update
    const creditCheck = await checkCredits(auth.tenantId, 'PATCH', '/api/memory')
    if (!creditCheck.allowed) {
      const x402 = buildX402Response(auth.tenantId, creditCheck.cost)
      return NextResponse.json(
        { error: x402 },
        { status: 402, headers: { 'X-Credits-Balance': '0', 'X-Credits-Needed': String(creditCheck.cost) } }
      )
    }

    const body = await request.json().catch(() => ({}))
    if (!body.content && !body.metadata && !body.tags && body.importance === undefined) {
      return respondError('validation_error', 'At least one field to update is required', 400)
    }

    const updates: Record<string, unknown> = {}
    if (body.content) {
      updates.content = body.content
      // Regenerate embedding if content changed
      try {
        const { generateEmbedding } = await import('@/lib/openai')
        const embedding = await generateEmbedding(body.content)
        updates.embedding = `[${embedding.join(',')}]`
      } catch (err: any) {
        console.error('Failed to regenerate embedding:', err.message)
      }
    }
    if (body.metadata) updates.metadata = body.metadata
    if (body.tags) updates.tags = body.tags
    if (body.importance !== undefined) updates.importance = body.importance

    const { data, error } = await supabase
      .from('memories')
      .update(updates)
      .eq('id', id)
      .eq('tenant_id', auth.tenantId)
      .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return respondError('not_found', 'Memory not found', 404)
      }
      return respondError('internal_error', 'Update failed: ' + error.message, 500)
    }

    const nbPatch = await deductCredits(auth.tenantId, 'PATCH', '/api/memory', data.id)
    fireWebhook(auth.tenantId, 'memory.updated', {
      memory_id: data.id,
      content_preview: (data.content || '').slice(0, 200),
      tags: data.tags,
      importance: data.importance,
    })
    return respond(data, 200, { credits_remaining: nbPatch ?? undefined })
  } catch (err: any) {
    console.error('PATCH /api/memory error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
