/**
 * GET /api/webhooks/retry-cron
 * Vercel Cron Job — process failed webhook deliveries due for retry.
 * Runs every 5 minutes (configured in vercel.json).
 */
import { NextRequest, NextResponse } from 'next/server'
import { retryFailedDeliveries } from '@/lib/webhooks'

export async function GET(request: NextRequest) {
  // Only Vercel Cron or local dev
  if (request.headers.get('x-vercel-cron') !== '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const result = await retryFailedDeliveries()
    return NextResponse.json({ ok: true, ...result, checked_at: new Date().toISOString() })
  } catch (err: any) {
    console.error('[webhook-retry-cron] Error:', err.message)
    return NextResponse.json({ ok: false, error: err.message })
  }
}

export { GET as POST }
