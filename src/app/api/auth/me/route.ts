import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { respond, respondError } from '@/lib/response'

/**
 * GET /api/auth/me
 * Returns the current user's profile and API key.
 * Requires Supabase Auth Bearer token (not Neura API key).
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return respondError('unauthorized', 'Missing authorization header', 401)
    }

    const token = authHeader.slice(7)

    // Verify the Supabase Auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return respondError('unauthorized', 'Invalid or expired token', 401)
    }

    // Get user profile + API key
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return respondError('not_found', 'User profile not found', 404)
    }

    // Get the user's API key (the default one)
    const { data: apiKey, error: keyError } = await supabase
      .from('api_keys')
      .select('id, label, is_active, created_at, last_used_at')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single()

    // Get credit balance
    const { data: credits } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('tenant_id', profile.tenant_id)
      .single()

    return respond({
      user: {
        id: user.id,
        email: user.email,
        plan: profile.plan,
        created_at: profile.created_at,
      },
      api_key: apiKey || null,
      credits: credits?.balance || 0,
    })
  } catch (err: any) {
    console.error('GET /api/auth/me error:', err)
    return respondError('internal_error', err.message, 500)
  }
}
