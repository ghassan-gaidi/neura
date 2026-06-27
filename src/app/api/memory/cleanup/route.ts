/**
 * GET /api/memory/cleanup
 * Vercel Cron Job — deletes expired memories (expires_at < now()).
 * Runs daily (configured in vercel.json).
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  if (request.headers.get('x-vercel-cron') !== '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
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
