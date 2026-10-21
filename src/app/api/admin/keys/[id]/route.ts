import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { respond, respondError } from '@/lib/response'
import { checkRateLimit } from '@/lib/middleware'

/**
 * DELETE /api/admin/keys/[id]
 * Revoke (deactivate) an API key by ID.
 * Only the key's tenant can revoke it.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let rl: ReturnType<typeof checkRateLimit> | undefined
  try {
    const auth = await resolveApiKey(_request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)

    const { id } = await params

    // Verify the key belongs to this tenant
    const { data: key, error: fetchError } = await supabase
      .from('api_keys')
      .select('id, tenant_id, is_active')
      .eq('id', id)
      .single()

    if (fetchError || !key) {
      return respondError('not_found', 'API key not found', 404, undefined, rl)
    }

    if (key.tenant_id !== auth.tenantId) {
      return respondError('forbidden', 'You do not own this API key', 403, undefined, rl)
    }

    if (!key.is_active) {
      return respondError('conflict', 'API key is already revoked', 409, undefined, rl)
    }

    // Deactivate the key
    const { error: updateError } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id)

    if (updateError) {
      return respondError('internal_error', 'Failed to revoke key: ' + updateError.message, 500, undefined, rl)
    }

    return respond({ id, revoked: true }, 200, undefined, rl)
  } catch (err: any) {
    console.error('DELETE /api/admin/keys/[id] error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 }, rl)
  }
}
