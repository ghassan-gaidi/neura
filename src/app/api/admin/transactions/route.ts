import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'

/**
 * GET /api/admin/transactions
 * List credit transactions for this tenant with pagination.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    const { data, error, count } = await supabase
      .from('credit_transactions')
      .select('id, amount, balance_after, transaction_type, description, reference_id, created_at', { count: 'estimated' })
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return respondError('internal_error', 'Failed to fetch transactions: ' + error.message, 500)
    }

    return respond(data || [], 200, { total: count || data?.length || 0 })
  } catch (err: any) {
    console.error('GET /api/admin/transactions error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
