import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { generateEmbedding } from '@/lib/openai'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { SearchMemoryRequest } from '@/lib/types'

/**
 * POST /api/memory/search
 * Advanced semantic search with filters, date ranges, and metadata matching.
 * Body: { query?, embedding?, filters?, limit?, min_score? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, {
        retry_after: Math.ceil(rl.resetMs / 1000),
      })
    }

    const body: SearchMemoryRequest = await request.json().catch(() => ({}))
    if (!body.query && !body.filters) {
      return respondError('validation_error', 'Provide a query or filters', 400)
    }

    const limit = Math.min(body.limit || 10, 100)
    const minScore = body.min_score || 0.0

    if (body.query) {
      // Vector search
      const queryEmbedding = body.embedding || await generateEmbedding(body.query)

      const { data, error } = await supabase.rpc('search_memories', {
        p_tenant_id: auth.tenantId,
        p_embedding: queryEmbedding,
        p_limit: limit,
        p_min_score: minScore,
      })

      if (error) {
        return respondError('internal_error', 'Search failed: ' + error.message, 500)
      }

      let results = (data || []).map((r: any) => ({
        ...r,
        score: r.similarity,
      }))

      // Apply client-side filters
      if (body.filters) {
        results = applyFilters(results, body.filters)
      }

      logUsage(auth, 'POST /api/memory/search')
      return respond(results, 200, { total: results.length, query: body.query })
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
    }

    const { data, error } = await query

    if (error) {
      return respondError('internal_error', 'Search failed: ' + error.message, 500)
    }

    logUsage(auth, 'POST /api/memory/search')
    return respond(data || [], 200, { total: data?.length || 0 })
  } catch (err: any) {
    console.error('POST /api/memory/search error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
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
