import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { badRequest, unauthorized, internalError, apiError, ErrorCodes, notFound } from '@/lib/errors'
import { logUsage } from '@/lib/usage'
import { UpsertStateRequest } from '@/lib/types'

/**
 * POST /api/state
 * Upsert a key-value state entry.
 * Body: { key: string, value: any }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const body: UpsertStateRequest = await request.json().catch(() => ({}))
    if (!body.key || typeof body.key !== 'string') {
      return badRequest('key is required and must be a string')
    }
    if (body.value === undefined) {
      return badRequest('value is required')
    }

    // Upsert: insert or update on conflict (tenant_id, key)
    const { data, error } = await supabase
      .from('state_store')
      .upsert(
        {
          tenant_id: auth.tenantId,
          key: body.key,
          value: body.value,
        },
        {
          onConflict: 'tenant_id, key',
          ignoreDuplicates: false,
        }
      )
      .select('key, value, created_at, updated_at')
      .single()

    if (error) {
      return apiError(ErrorCodes.INTERNAL_ERROR, 'State update failed: ' + error.message, 500)
    }

    logUsage(auth, 'POST /api/state')
    return NextResponse.json({ data }, { status: 201 })
  } catch (err: any) {
    console.error('POST /api/state error:', err)
    return internalError(err.message)
  }
}

/**
 * GET /api/state
 * Retrieve all state keys for this tenant.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return unauthorized()

    const { data, error } = await supabase
      .from('state_store')
      .select('key, value, created_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .order('key', { ascending: true })

    if (error) {
      return apiError(ErrorCodes.INTERNAL_ERROR, 'Failed to fetch state: ' + error.message, 500)
    }

    logUsage(auth, 'GET /api/state')
    return NextResponse.json({ data: data || [] })
  } catch (err: any) {
    console.error('GET /api/state error:', err)
    return internalError(err.message)
  }
}
