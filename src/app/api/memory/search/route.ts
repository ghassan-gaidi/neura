import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { generateEmbedding } from '@/lib/openai'
import { badRequest, unauthorized, internalError, apiError, ErrorCodes } from '@/lib/errors'
import { logUsage } from '@/lib/usage'
import { SearchMemoryRequest } from '@/lib/types'

/**
 * POST /api/memory/search
 * Advanced semantic search with filters, date ranges, and metadata matching.
 * Body: { query?, filters?, limit?, min_score? }
 * 
 * If query is provided, uses vector similarity.
 * If only filters are provided, uses metadata/tag matching.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const body: SearchMemoryRequest = await request.json().catch(() => ({}))

    if (!body.query && !body.filters) {
      return badRequest('Provide a query or filters')
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
        return apiError(ErrorCodes.INTERNAL_ERROR, 'Search failed: ' + error.message, 500)
      }

      let results = (data || []).map((r: any) => ({
        ...r,
        score: r.similarity,
      }))

      // Apply client-side filters if provided
      if (body.filters) {
        results = applyFilters(results, body.filters)
      }

      logUsage(auth, 'POST /api/memory/search')
      return NextResponse.json({
        data: results,
        meta: { total: results.length, query: body.query },
      })
    }

    // Filter-only search (no vector similarity)
    let query = supabase
      .from('memories')
      .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .limit(limit)
      .order('created_at', { ascending: false })

    // Apply DB-level filters
    if (body.filters) {
      if (body.filters.tags && body.filters.tags.length > 0) {
        // Filter by tag overlap
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
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Search failed: ' + error.message, 500)
    }

    logUsage(auth, 'POST /api/memory/search')
    return NextResponse.json({
      data: data || [],
      meta: { total: data?.length || 0 },
    })
  } catch (err: any) {
    console.error('POST /api/memory/search error:', err)
    return internalError(err.message)
  }
}

/** Apply client-side metadata filters to results */
function applyFilters(results: any[], filters: NonNullable<SearchMemoryRequest['filters']>) {
  return results.filter((r) => {
    if (filters.tags?.length && !filters.tags.some((t) => r.tags?.includes(t))) {
      return false
    }
    if (filters.importance_min !== undefined && (r.importance ?? 0) < filters.importance_min) {
      return false
    }
    if (filters.importance_max !== undefined && (r.importance ?? 0) > filters.importance_max) {
      return false
    }
    if (filters.date_from && new Date(r.created_at) < new Date(filters.date_from)) {
      return false
    }
    if (filters.date_to && new Date(r.created_at) > new Date(filters.date_to)) {
      return false
    }
    if (filters.metadata) {
      const meta = r.metadata || {}
      for (const [key, value] of Object.entries(filters.metadata)) {
        if (meta[key] !== value) return false
      }
    }
    return true
  })
}
