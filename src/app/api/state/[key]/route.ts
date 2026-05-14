import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { unauthorized, internalError, notFound, apiError, ErrorCodes } from '@/lib/errors'
import { logUsage } from '@/lib/usage'

/**
 * GET /api/state/[key]
 * Retrieve a single state value by key.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const { key } = await params
    if (!key) {
      return notFound('State key')
    }

    const { data, error } = await supabase
      .from('state_store')
      .select('key, value, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .eq('key', key)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound(`State key "${key}"`)
      }
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch state: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/state/:key')
    return NextResponse.json({ data })
  } catch (err: any) {
    console.error('GET /api/state/:key error:', err)
    return internalError(err.message)
  }
}

/**
 * DELETE /api/state/[key]
 * Remove a state entry by key.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const { key } = await params
    if (!key) {
      return notFound('State key')
    }

    const { data, error } = await supabase
      .from('state_store')
      .delete()
      .eq('tenant_id', auth.tenantId)
      .eq('key', key)
      .select('key')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return notFound(`State key "${key}"`)
      }
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Delete failed: ' + error.message, 500)
    }

    return NextResponse.json({ data: { key, deleted: true } })
  } catch (err: any) {
    console.error('DELETE /api/state/:key error:', err)
    return internalError(err.message)
  }
}
