import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { checkCredits, deductCredits, buildX402Response } from '@/lib/credits'

/**
 * POST /api/memory/summarize
 * Summarize a set of memories.
 * Body: { memory_ids?: string[], query?: string, type?: 'extractive' | 'abstractive' }
 * 
 * Agents use this to compress conversation history, distill facts,
 * or create concise summaries of what was learned.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    // Credits check — 5 credits for summarization
    const creditCheck = await checkCredits(auth.tenantId, 'POST', '/api/memory/summarize')
    if (!creditCheck.allowed) {
      const x402 = buildX402Response(auth.tenantId, creditCheck.cost)
      return NextResponse.json(
        { error: x402 },
        { status: 402, headers: { 'X-Credits-Balance': '0', 'X-Credits-Needed': String(creditCheck.cost) } }
      )
    }

    const body = await request.json().catch(() => ({}))
    if (!body.memory_ids && !body.query) {
      return respondError('validation_error', 'Provide memory_ids or a query to select memories', 400)
    }

    // Fetch the memories to summarize
    let memories: any[] = []

    if (body.memory_ids && Array.isArray(body.memory_ids)) {
      const { data, error } = await supabase
        .from('memories')
        .select('id, content, tags, importance, created_at')
        .eq('tenant_id', auth.tenantId)
        .in('id', body.memory_ids)
        .order('created_at', { ascending: true })

      if (error) return respondError('internal_error', 'Failed to fetch memories: ' + error.message, 500)
      memories = data || []
    } else if (body.query) {
      const { generateEmbedding } = await import('@/lib/openai')
      const embedding = await generateEmbedding(body.query)

      const { data, error } = await supabase.rpc('search_memories', {
        p_tenant_id: auth.tenantId,
        p_embedding: embedding,
        p_limit: body.limit || 50,
        p_min_score: body.min_score || 0.0,
      })

      if (error) return respondError('internal_error', 'Search failed: ' + error.message, 500)
      memories = (data || []).map((r: any) => ({
        id: r.id,
        content: r.content,
        tags: r.tags,
        importance: r.importance,
        created_at: r.created_at,
        score: r.similarity,
      }))
    }

    if (memories.length === 0) {
      return respond({ summary: 'No memories found to summarize.', total_memories: 0 }, 200)
    }

    // Build summary
    const summaryType = body.type || 'extractive'
    let summary: string

    if (summaryType === 'extractive') {
      // Simple extractive: concatenate most important memories
      const sorted = [...memories].sort((a, b) => (b.importance || 0) - (a.importance || 0))
      const topMemories = sorted.slice(0, 10)
      summary = topMemories.map((m) => `[${m.importance}/10] ${m.content}`).join('\n\n')
    } else {
      // Abstractive: use OpenAI to generate a summary
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) {
        return respondError('internal_error', 'OpenAI API key not configured for abstractive summaries', 500, {
          action: 'use_extractive_summary',
        })
      }

      const content = memories.map((m) => `- ${m.content}`).join('\n')
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: 'Summarize the following memories concisely. Extract key facts, preferences, and decisions. Group related information.',
            },
            { role: 'user', content },
          ],
          max_tokens: 500,
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        return respondError('internal_error', 'AI summary failed: ' + errText, 500)
      }

      const result = await response.json()
      summary = result.choices?.[0]?.message?.content || 'Summary generation failed.'
    }

    logUsage(auth, 'POST /api/memory/summarize')
    const nbSummary = await deductCredits(auth.tenantId, 'POST', '/api/memory/summarize')
    return respond({
      summary,
      total_memories: memories.length,
      summary_type: summaryType,
      memory_ids: memories.map((m) => m.id),
    }, 200, { credits_remaining: nbSummary ?? undefined })
  } catch (err: any) {
    console.error('POST /api/memory/summarize error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
