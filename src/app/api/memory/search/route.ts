import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { generateEmbedding } from '@/lib/embeddings'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError, respondPaymentRequired } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { SearchMemoryRequest } from '@/lib/types'
import { checkCredits, deductCredits, buildX402Response, fireCreditsLowIfLow } from '@/lib/credits'

/**
 * POST /api/memory/search
 * Advanced semantic search with filters, date ranges, and metadata matching.
 * Body: { query?, embedding?, filters?, limit?, min_score? }
 */
export async function POST(request: NextRequest) {
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

    // Credits check — 2 credits for advanced search
    const creditCheck = await checkCredits(auth.tenantId, 'POST', '/api/memory/search')
    if (!creditCheck.allowed) {
      const x402 = buildX402Response(auth.tenantId, creditCheck.cost)
      return respondPaymentRequired(x402, rl, {
        'X-Credits-Balance': '0',
        'X-Credits-Needed': String(creditCheck.cost),
      })
    }

    const body: SearchMemoryRequest = await request.json().catch(() => ({}))
    if (!body.query && !body.filters) {
      return respondError('validation_error', 'Provide a query or filters', 400, undefined, rl)
    }

    const limit = Math.min(body.limit || 10, 100)
    const minScore = body.min_score || 0.0

    if (body.query) {
      // Vector search with SQL-side filters before LIMIT
      const queryEmbedding = body.embedding || await generateEmbedding(body.query)
      const f = body.filters || {}

      const { data, error } = await supabase.rpc('search_memories_filtered', {
        p_tenant_id: auth.tenantId,
        p_embedding: queryEmbedding,
        p_limit: limit,
        p_min_score: minScore,
        p_tags: f.tags?.length ? f.tags : null,
        p_importance_min: f.importance_min ?? null,
        p_importance_max: f.importance_max ?? null,
        p_date_from: f.date_from ?? null,
        p_date_to: f.date_to ?? null,
      })

      if (error) {
        return respondError('internal_error', 'Search failed: ' + error.message, 500, undefined, rl)
      }

      let results = (data || []).map((r: any) => ({
        ...r,
        score: r.similarity,
      }))

      // metadata is not expressible in the RPC; apply it here only
      if (f.metadata) {
        results = applyFilters(results, { metadata: f.metadata })
      }

      logUsage(auth, 'POST /api/memory/search')
      const nb1 = await deductCredits(auth.tenantId, 'POST', '/api/memory/search')
      fireCreditsLowIfLow(auth.tenantId, nb1)
      return respond(results, 200, { total: results.length, query: body.query, credits_remaining: nb1 ?? undefined }, rl)
    }

    // Filter-only search
    let query = supabase
      .from('memories')
      .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .limit(limit)
      .order('created_at', { ascending: false })

    if (body.filters) {
      if (body.filters.tags?.length) {
        query = query.overlaps('tags', body.filters.tags)
      }
      if (body.filters.importance_min !== undefined) {
        query = query.gte('importance', body.filters.importance_min)
      }
      if (body.filters.importance_max !== undefined) {
        query = query.lte('importance', body.filters.importance_max)
      }
      if (body.filters.date_from) {
        query = query.gte('created_at', body.filters.date_from)
      }
      if (body.filters.date_to) {
        query = query.lte('created_at', body.filters.date_to)
      }
      if (body.filters.metadata) {
        for (const [key, value] of Object.entries(body.filters.metadata)) {
          query = query.contains('metadata', { [key]: value })
        }
      }
    }

    const { data, error } = await query

    if (error) {
      return respondError('internal_error', 'Search failed: ' + error.message, 500, undefined, rl)
    }

    logUsage(auth, 'POST /api/memory/search')
    const nb2 = await deductCredits(auth.tenantId, 'POST', '/api/memory/search')
    fireCreditsLowIfLow(auth.tenantId, nb2)
    return respond(data || [], 200, { total: data?.length || 0, credits_remaining: nb2 ?? undefined }, rl)
  } catch (err: any) {
    console.error('POST /api/memory/search error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 }, rl)
  }
}

function applyFilters(results: any[], filters: NonNullable<SearchMemoryRequest['filters']>) {
  return results.filter((r) => {
    if (filters.tags?.length && !filters.tags.some((t) => r.tags?.includes(t))) return false
    if (filters.importance_min !== undefined && (r.importance ?? 0) < filters.importance_min) return false
    if (filters.importance_max !== undefined && (r.importance ?? 0) > filters.importance_max) return false
    if (filters.date_from && new Date(r.created_at) < new Date(filters.date_from)) return false
    if (filters.date_to && new Date(r.created_at) > new Date(filters.date_to)) return false
    if (filters.metadata) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        if ((r.metadata || {})[key] !== value) return false
      }
    }
    return true
  })
}
