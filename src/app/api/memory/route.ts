import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { generateEmbedding } from '@/lib/embeddings'
import { checkRateLimit, withIdempotency } from '@/lib/middleware'
import { respond, respondError, respondPaymentRequired } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { CreateMemoryRequest, AuthContext } from '@/lib/types'
import { fireWebhook } from '@/lib/webhooks'
import { checkCredits, deductCredits, buildX402Response, checkMemoryLimit, fireCreditsLowIfLow } from '@/lib/credits'

function getUsageMeta(auth: AuthContext, balance?: number) {
  return balance !== undefined
    ? { credits_remaining: balance }
    : {}
}

/**
 * POST /api/memory
 * Store a memory with auto-embedding via OpenAI.
 * Supports Idempotency-Key header for safe retries.
 * Body: { content, metadata?, tags?, importance?, expires_at? }
 */
export async function POST(request: NextRequest) {
  let rl: ReturnType<typeof checkRateLimit> | undefined
try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401, {
      action: 'provide_valid_api_key',
      docs_url: 'https://neura.sh/docs/authentication',
    })

    return await withIdempotency(async (req: NextRequest, auth: AuthContext) => {
      // Rate limit check
      rl = checkRateLimit(auth.apiKeyId)
      if (!rl.allowed) {
        return respondError('rate_limited', 'Rate limit exceeded. Please wait and retry.', 429, {
          action: 'wait_and_retry',
          retry_after: Math.ceil(rl.resetMs / 1000),
        }, rl)
      }

      // Free tier limit — 100 memories for the free plan
      const limit = await checkMemoryLimit(auth.tenantId)
      if (!limit.allowed) {
        return respondError('free_tier_limit', `Free tier allows ${limit.limit} memories. Upgrade to add more.`, 403, { action: 'upgrade_plan' }, rl)
      }

      // Credits check
      const creditCheck = await checkCredits(auth.tenantId, 'POST', '/api/memory')
      if (!creditCheck.allowed) {
        const x402 = buildX402Response(auth.tenantId, creditCheck.cost)
        return respondPaymentRequired(x402, rl, {
          'X-Credits-Balance': '0',
          'X-Credits-Needed': String(creditCheck.cost),
        })
      }

      const body: CreateMemoryRequest = await req.json().catch(() => ({}))
      if (!body.content || typeof body.content !== 'string') {
        return respondError('validation_error', 'content is required and must be a string', 400, undefined, rl)
      }

      // Generate embedding
      let embedding: number[] | null = null
      try {
        embedding = await generateEmbedding(body.content)
      } catch (err: any) {
        return respondError('internal_error', 'Failed to generate embedding: ' + err.message, 500, {
          action: 'retry_with_explicit_embedding',
        }, rl)
      }

      const { data, error } = await supabase
        .from('memories')
        .insert({
          tenant_id: auth.tenantId,
          content: body.content,
          embedding: embedding ? `[${embedding.join(',')}]` : null,
          metadata: body.metadata || {},
          tags: body.tags || [],
          importance: body.importance ?? 0,
          expires_at: body.expires_at || null,
        })
        .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
        .single()

      if (error) {
        return respondError('internal_error', 'Failed to store memory: ' + error.message, 500, undefined, rl)
      }

      logUsage(auth, 'POST /api/memory')
      fireWebhook(auth.tenantId, 'memory.created', {
        memory_id: data.id,
        content_preview: data.content.slice(0, 200),
        tags: data.tags,
        importance: data.importance,
      })
      // Deduct credits
      const newBalance = await deductCredits(auth.tenantId, 'POST', '/api/memory', data.id)
      fireCreditsLowIfLow(auth.tenantId, newBalance)
      return respond(data, 201, getUsageMeta(auth, newBalance ?? undefined), rl)
    })(request, auth)
  } catch (err: any) {
    console.error('POST /api/memory error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 }, rl)
  }
}

/**
 * GET /api/memory?query=...&limit=...&min_score=...
 * Semantic search or recent memory listing.
 */
export async function GET(request: NextRequest) {
  let rl: ReturnType<typeof checkRateLimit> | undefined
try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, {
        retry_after: Math.ceil(rl.resetMs / 1000),
      }, rl)
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100)
    const minScore = parseFloat(searchParams.get('min_score') || '0.0')

    if (!query) {
      // No query — return most recent (free)
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return respondError('internal_error', 'Query failed: ' + error.message, 500, undefined, rl)
      }

      logUsage(auth, 'GET /api/memory')
      return respond(data || [], 200, { total: data?.length || 0, ...getUsageMeta(auth) }, rl)
    }

    // Semantic search — costs 1 credit
    // Check credits BEFORE generating embedding to avoid wasting API calls
    const creditCheck = await checkCredits(auth.tenantId, 'GET', '/api/memory')
    if (!creditCheck.allowed) {
      const x402 = buildX402Response(auth.tenantId, creditCheck.cost)
      return respondPaymentRequired(x402, rl, {
        'X-Credits-Balance': '0',
        'X-Credits-Needed': String(creditCheck.cost),
      })
    }

    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (err: any) {
      return respondError('internal_error', 'Failed to generate query embedding: ' + err.message, 500, undefined, rl)
    }

    const { data, error } = await supabase.rpc('search_memories', {
      p_tenant_id: auth.tenantId,
      p_embedding: queryEmbedding,
      p_limit: limit,
      p_min_score: minScore,
    })

    if (error) {
      console.error('Vector search RPC failed:', error.message)
      // Fallback: return recent (no vector search available)
      const { data: fallback, error: fbErr } = await supabase
        .from('memories')
        .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .limit(limit)

      if (fbErr) {
        return respondError('internal_error', 'Search failed: ' + fbErr.message, 500, undefined, rl)
      }

      logUsage(auth, 'GET /api/memory')
      return respond(fallback || [], 200, {
        total: fallback?.length || 0,
        query,
        ...getUsageMeta(auth),
      }, rl)
    }

    const results = (data || []).map((r: any) => ({
      ...r,
      score: r.similarity,
    }))

    logUsage(auth, 'GET /api/memory')
    const newBalance = await deductCredits(auth.tenantId, 'GET', '/api/memory')
    fireCreditsLowIfLow(auth.tenantId, newBalance)
    return respond(results, 200, { total: results.length, query, ...getUsageMeta(auth, newBalance ?? undefined) }, rl)
  } catch (err: any) {
    console.error('GET /api/memory error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 }, rl)
  }
}
