import { NextRequest } from 'next/server'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { retryFailedDeliveries } from '@/lib/webhooks'

/**
 * POST /api/webhooks/retry
 * Process pending/failed webhook deliveries due for retry.
 * Called by Vercel cron or manually with admin key.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const result = await retryFailedDeliveries()
    return respond(result, 200)
  } catch (err: any) {
    console.error('POST /api/webhooks/retry error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * GET /api/webhooks/retry
 * Health check / status endpoint.
 */
export async function GET() {
  return respond({ message: 'Webhook retry endpoint. POST to process failed deliveries.' })
}
