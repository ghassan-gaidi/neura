import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { generateEmbedding } from '@/lib/embeddings'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { fireWebhook } from '@/lib/webhooks'
import { checkCredits, deductCredits, buildX402Response } from '@/lib/credits'
import { AuthContext } from '@/lib/types'

const MAX_BATCH_CREATE = 25
const MAX_BATCH_DELETE = 100

function getUsageMeta(auth: AuthContext, balance?: number) {
  return balance !== undefined
    ? { credits_remaining: balance }
    : {}
}

/**
 * POST /api/memory/batch
 * Store multiple memories at once.
 * Body: { memories: [{ content, metadata?, tags?, importance?, expires_at? }] }
 * Max 25 per batch. Costs 1 credit per memory.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)
    }

    const body = await request.json().catch(() => ({}))
    if (!body.memories || !Array.isArray(body.memories) || body.memories.length === 0) {
      return respondError('validation_error', 'memories must be a non-empty array', 400)
    }

    if (body.memories.length > MAX_BATCH_CREATE) {
      return respondError('validation_error', `Max ${MAX_BATCH_CREATE} memories per batch`, 400)
    }

    // Validate all memories
    for (let i = 0; i < body.memories.length; i++) {
      const m = body.memories[i]
      if (!m.content || typeof m.content !== 'string') {
        return respondError('validation_error', `memories[${i}].content is required and must be a string`, 400)
      }
    }

    // Credits check
    const totalCost = body.memories.length
    const creditCheck = await checkCredits(auth.tenantId, 'POST', '/api/memory/batch')
    if (!creditCheck.allowed || (creditCheck.balance || 0) < totalCost) {
      const x402 = buildX402Response(auth.tenantId, totalCost)
      return NextResponse.json(
        { error: x402 },
        { status: 402, headers: { 'X-Credits-Balance': String(creditCheck.balance || 0), 'X-Credits-Needed': String(totalCost) } }
      )
    }

    // Generate embeddings in parallel
    const embeddingResults = await Promise.allSettled(
      body.memories.map((m: any) => generateEmbedding(m.content))
    )

    const rows = body.memories.map((m: any, i: number) => {
      const emb = embeddingResults[i]
      return {
        tenant_id: auth.tenantId,
        content: m.content,
        embedding: emb.status === 'fulfilled' ? `[${emb.value.join(',')}]` : null,
        metadata: m.metadata || {},
        tags: m.tags || [],
        importance: m.importance ?? 0,
        expires_at: m.expires_at || null,
      }
    })

    const { data, error } = await supabase
      .from('memories')
      .insert(rows)
      .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')

    if (error) {
      return respondError('internal_error', 'Failed to store memories: ' + error.message, 500)
    }

    logUsage(auth, 'POST /api/memory/batch')

    // Fire webhooks for each memory
    for (const mem of data || []) {
      fireWebhook(auth.tenantId, 'memory.created', {
        memory_id: mem.id,
        content_preview: mem.content.slice(0, 200),
        tags: mem.tags,
        importance: mem.importance,
      })
    }

    const newBalance = await deductCredits(auth.tenantId, 'POST', '/api/memory/batch', `batch-${Date.now()}`)
    return respond({ stored: data?.length || 0, memories: data || [] }, 201, getUsageMeta(auth, newBalance ?? undefined))
  } catch (err: any) {
    console.error('POST /api/memory/batch error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * DELETE /api/memory/batch
 * Delete multiple memories by IDs.
 * Body: { ids: string[] }
 * Max 100 per batch. Free operation.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)
    }

    const body = await request.json().catch(() => ({}))
    if (!body.ids || !Array.isArray(body.ids) || body.ids.length === 0) {
      return respondError('validation_error', 'ids must be a non-empty array', 400)
    }

    if (body.ids.length > MAX_BATCH_DELETE) {
      return respondError('validation_error', `Max ${MAX_BATCH_DELETE} IDs per batch`, 400)
    }

    const { data, error } = await supabase
      .from('memories')
      .delete()
      .in('id', body.ids)
      .eq('tenant_id', auth.tenantId)
      .select('id')

    if (error) {
      return respondError('internal_error', 'Batch delete failed: ' + error.message, 500)
    }

    // Fire webhooks
    for (const mem of data || []) {
      fireWebhook(auth.tenantId, 'memory.deleted', { memory_id: mem.id })
    }

    logUsage(auth, 'DELETE /api/memory/batch')
    return respond({ deleted: data?.length || 0, ids: data?.map((m: any) => m.id) || [] }, 200)
  } catch (err: any) {
    console.error('DELETE /api/memory/batch error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
