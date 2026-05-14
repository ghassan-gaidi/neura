import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'

/**
 * GET /api/admin/usage
 * Usage analytics for the current tenant.
 * Query params: days (default 7)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const { searchParams } = new URL(request.url)
    const days = Math.min(parseInt(searchParams.get('days') || '7', 10), 90)

    const since = new Date()
    since.setDate(since.getDate() - days)

    // Get usage logs grouped by endpoint and day
    const { data: usageByEndpoint, error: usageErr } = await supabase
      .from('usage_logs')
      .select('endpoint, created_at')
      .eq('tenant_id', auth.tenantId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: false })

    if (usageErr) {
      return respondError('internal_error', 'Failed to fetch usage: ' + usageErr.message, 500)
    }

    const usageLogs = usageByEndpoint || []
    
    // Aggregate by endpoint
    const endpointCounts: Record<string, number> = {}
    const dailyCounts: Record<string, number> = {}

    for (const log of usageLogs || []) {
      const ep = log.endpoint || 'unknown'
      endpointCounts[ep] = (endpointCounts[ep] || 0) + 1

      const day = log.created_at?.slice(0, 10)
      if (day) dailyCounts[day] = (dailyCounts[day] || 0) + 1
    }

    // Get credit consumption
    const { data: creditSpending } = await supabase
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('tenant_id', auth.tenantId)
      .eq('transaction_type', 'spend')
      .gte('created_at', since.toISOString())

    const creditsUsed = creditSpending?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0

    // Get credit purchases
    const { data: creditPurchases } = await supabase
      .from('credit_transactions')
      .select('amount, created_at')
      .eq('tenant_id', auth.tenantId)
      .in('transaction_type', ['purchase', 'bonus'])
      .gte('created_at', since.toISOString())

    const creditsPurchased = creditPurchases?.reduce((sum, t) => sum + t.amount, 0) || 0

    return respond({
      period_days: days,
      total_requests: (usageLogs || []).length,
      credits_used: creditsUsed,
      credits_purchased: creditsPurchased,
      by_endpoint: endpointCounts,
      by_day: dailyCounts,
    }, 200)
  } catch (err: any) {
    console.error('GET /api/admin/usage error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
