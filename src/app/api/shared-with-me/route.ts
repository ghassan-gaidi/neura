import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'

/**
 * GET /api/shared-with-me
 * List memories shared with this agent by others.
 * Returns the original memory content with share metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '50', 10), 100)

    const { data, error } = await supabase
      .from('shared_memories')
      .select(`
        id,
        permission,
        created_at,
        memory:memories!inner(id, content, metadata, tags, importance, created_at, updated_at)
      `)
      .eq('target_tenant_id', auth.tenantId)
      .limit(limit)
      .order('created_at', { ascending: false })

    if (error) {
      return respondError('internal_error', 'Failed to fetch shared memories: ' + error.message, 500)
    }

    // Flatten the nested response
    const results = (data || []).map((s: any) => ({
      share_id: s.id,
      permission: s.permission,
      shared_at: s.created_at,
      ...s.memory,
    }))

    logUsage(auth, 'GET /api/shared-with-me')
    return respond(results, 200)
  } catch (err: any) {
    console.error('GET /api/shared-with-me error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
