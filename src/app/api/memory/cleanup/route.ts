/**
 * GET /api/memory/cleanup
 * Vercel Cron Job — deletes expired memories (expires_at < now()).
 * Runs daily (configured in vercel.json).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fireWebhook } from '@/lib/webhooks'

export async function GET(request: NextRequest) {
  if (request.headers.get('x-vercel-cron') !== '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
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
      return NextResponse.json({ ok: false, error: error.message })
    }

    if (count > 0) {
      console.log(`[memory-ttl] Deleted ${count} expired memories`)
    }

    return NextResponse.json({ ok: true, deleted: count, checked_at: new Date().toISOString() })
  } catch (err: any) {
    console.error('[memory-ttl] Error:', err.message)
    return NextResponse.json({ ok: false, error: err.message })
  }
}

export { GET as POST }
