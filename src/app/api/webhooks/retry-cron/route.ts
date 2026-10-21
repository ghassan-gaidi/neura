/**
 * GET /api/webhooks/retry-cron
 * Vercel Cron Job — process failed webhook deliveries due for retry.
 * Runs every 5 minutes (configured in vercel.json).
 */
import { NextRequest, NextResponse } from 'next/server'
import { retryFailedDeliveries } from '@/lib/webhooks'
import { checkRateLimit } from '@/lib/middleware'
import { respondError } from '@/lib/response'

export async function GET(request: NextRequest) {
  // Only Vercel Cron or local dev
  if (request.headers.get('x-vercel-cron') !== '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = checkRateLimit(`ip:${ip}`)
  if (!rl.allowed) {
    return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)
  }

  try {
    const result = await retryFailedDeliveries()
    const response = NextResponse.json({ ok: true, ...result, checked_at: new Date().toISOString() })
    response.headers.set('X-RateLimit-Limit', String(rl.limit))
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
    return response
  } catch (err: any) {
    console.error('[webhook-retry-cron] Error:', err.message)
    const response = NextResponse.json({ ok: false, error: err.message }, { status: 500 })
    response.headers.set('X-RateLimit-Limit', String(rl.limit))
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
    return response
  }
}

export { GET as POST }
