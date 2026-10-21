/**
 * GET /api/memory/cleanup
 * Vercel Cron Job — deletes expired memories (expires_at < now()).
 * Runs daily (configured in vercel.json).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fireWebhook } from '@/lib/webhooks'
import { checkRateLimit } from '@/lib/middleware'
import { respondError } from '@/lib/response'

export async function GET(request: NextRequest) {
  if (request.headers.get('x-vercel-cron') !== '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = checkRateLimit(`ip:${ip}`)
  if (!rl.allowed) {
    return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)
  }

  try {
    // Notify memories that will expire within the next 24 hours
    const { data: expiring } = await supabase
      .from('memories')
      .select('id, tenant_id, expires_at')
      .gt('expires_at', new Date().toISOString())
      .lt('expires_at', new Date(Date.now() + 86_400_000).toISOString())

    const byTenant = new Map<string, NonNullable<typeof expiring>>()
    for (const mem of expiring || []) {
      const list = byTenant.get(mem.tenant_id) || []
      list.push(mem)
      byTenant.set(mem.tenant_id, list)
    }
    for (const [tenantId, mems] of byTenant) {
      for (const mem of mems) {
        fireWebhook(tenantId, 'memory.expiring', {
          memory_id: mem.id,
          expires_at: mem.expires_at,
        })
      }
    }

    const { data: deleted, error } = await supabase
      .from('memories')
      .delete()
      .lt('expires_at', new Date().toISOString())
      .select('id')

    const count = deleted?.length || 0
    if (error) {
      console.error('[memory-ttl] Error:', error.message)
      const response = NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      response.headers.set('X-RateLimit-Limit', String(rl.limit))
      response.headers.set('X-RateLimit-Remaining', String(rl.remaining))
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
      return response
    }

    if (count > 0) {
      console.log(`[memory-ttl] Deleted ${count} expired memories`)
    }

    const response = NextResponse.json({ ok: true, deleted: count, checked_at: new Date().toISOString() })
    response.headers.set('X-RateLimit-Limit', String(rl.limit))
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
    return response
  } catch (err: any) {
    console.error('[memory-ttl] Error:', err.message)
    const response = NextResponse.json({ ok: false, error: err.message }, { status: 500 })
    response.headers.set('X-RateLimit-Limit', String(rl.limit))
    response.headers.set('X-RateLimit-Remaining', String(rl.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
    return response
  }
}

export { GET as POST }
