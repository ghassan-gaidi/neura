import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { generateEmbedding } from '@/lib/openai'
import { badRequest, unauthorized, internalError, notFound, apiError, ErrorCodes } from '@/lib/errors'
import { logUsage } from '@/lib/usage'
import { CreateMemoryRequest, Memory } from '@/lib/types'
import { AuthContext } from '@/lib/types'

/**
 * POST /api/memory
 * Store a memory. Content is auto-embedded via OpenAI.
 * Body: { content, metadata?, tags?, importance?, expires_at? }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const body: CreateMemoryRequest = await request.json().catch(() => ({}))
    if (!body.content || typeof body.content !== 'string') {
      return badRequest('content is required and must be a string')
    }

    // Generate embedding from the content
    let embedding: number[] | null = null
    try {
      embedding = await generateEmbedding(body.content)
    } catch (err: any) {
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate embedding: ' + err.message, 500, {
        action: 'retry_with_explicit_embedding',
      })
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
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Failed to store memory: ' + error.message, 500)
    }

    logUsage(auth, 'POST /api/memory')

    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/memory error:', err)
    return internalError(err.message)
  }
}

/**
 * GET /api/memory?query=...&limit=...&min_score=...
 * Semantic search. Returns memories ranked by cosine similarity.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 100)
    const minScore = parseFloat(searchParams.get('min_score') || '0.0')

    if (!query) {
      // No query — return most recent memories
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
        .eq('tenant_id', auth.tenantId)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        return apiError(ErrorCodes.INTERNAL_ERROR, 'Query failed: ' + error.message, 500)
      }

      logUsage(auth, 'GET /api/memory')
      return NextResponse.json({ data, meta: { total: data?.length || 0 } })
    }

    // Semantic search — generate embedding, then vector search
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (err: any) {
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Failed to generate query embedding: ' + err.message, 500)
    }

    // Use pgvector via RPC for cosine similarity search
    // Supabase JS SDK doesn't natively support vector operators in from().select()
    const { data, error } = await supabase.rpc('search_memories', {
      p_tenant_id: auth.tenantId,
      p_embedding: queryEmbedding,
      p_limit: limit,
      p_min_score: minScore,
    })

    if (error) {
      // Fallback: fetch all and sort in-memory (slow, but works without the RPC)
      console.error('Vector search RPC failed, using fallback:', error.message)
      const { data: allMemories, error: fetchError } = await supabase
        .from('memories')
        .select('id, content, metadata, tags, importance, expires_at, created_at, updated_at')
        .eq('tenant_id', auth.tenantId)

      if (fetchError) {
        return apiError(ErrorCodes.INTERNAL_ERROR, 'Query failed: ' + fetchError.message, 500)
      }

      logUsage(auth, 'GET /api/memory')
      return NextResponse.json({
        data: allMemories?.slice(0, limit) || [],
        meta: { total: allMemories?.length || 0, query, note: 'semantic_search_unavailable' },
      })
    }

    logUsage(auth, 'GET /api/memory')

    const results = (data || []).map((r: any) => ({
      ...r,
      score: r.similarity,
    }))

    return NextResponse.json({
      data: results,
      meta: { total: results.length, query },
    })
  } catch (err: any) {
    console.error('GET /api/memory error:', err)
    return internalError(err.message)
  }
}
