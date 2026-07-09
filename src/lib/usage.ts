import { supabase } from '@/lib/supabase'
import { AuthContext } from '@/lib/types'

/**
 * Log a usage event for this API request.
 * Fire-and-forget — never blocks the response.
 */
export function logUsage(auth: AuthContext, endpoint: string, tokensUsed = 0) {
  void supabase.from('usage_logs').insert({
    tenant_id: auth.tenantId,
    api_key_id: auth.apiKeyId,
    endpoint,
    tokens_used: tokensUsed,
  }).then(() => {}, () => {})
}

/**
 * Wrap a handler with auth + error handling boilerplate.
 */
import { NextRequest, NextResponse } from 'next/server'
import { resolveApiKey } from './auth'
import { unauthorized, internalError, apiError, ErrorCodes } from './errors'

type Handler = (
  req: NextRequest,
  auth: AuthContext,
  params?: { params: Promise<Record<string, string>> }
) => Promise<NextResponse>

export function withAuth(handler: Handler): Handler {
  return async (req, _auth, params) => {
    try {
      const auth = await resolveApiKey(req)
      if (!auth) {
        return unauthorized()
      }
      return handler(req, auth, params)
    } catch (err: any) {
      console.error('Unhandled error:', err)
      return internalError(err.message)
    }
  }
}
