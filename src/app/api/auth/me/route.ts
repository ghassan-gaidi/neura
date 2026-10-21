import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { respond, respondError } from '@/lib/response'
import { checkRateLimit } from '@/lib/middleware'
import crypto from 'crypto'

/**
 * GET /api/auth/me
 * Returns the current user's profile and API key.
 * Requires Supabase Auth Bearer token (not Neura API key).
 * On first access, automatically generates the user's initial API key.
 */
export async function GET(request: NextRequest) {
  let rl: ReturnType<typeof checkRateLimit> | undefined
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

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    rl = checkRateLimit(`user:${user.id}:${ip}`)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)

    // Get user profile + API key
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      // First visit — auto-create profile, API key, and credits
      const tenantId = crypto.randomUUID()

      // Create user profile
      const { error: insertError } = await supabase
        .from('users')
        .insert({ id: user.id, email: user.email, tenant_id: tenantId })

      if (insertError) {
        return respondError('internal_error', 'Failed to create profile: ' + insertError.message, 500, undefined, rl)
      }

      // Create API key
      const newRawKey = `sk-${crypto.randomBytes(32).toString('hex')}`
      const keyHash = crypto.createHash('sha256').update(newRawKey).digest('hex')

      const { data: newKey, error: keyInsertError } = await supabase
        .from('api_keys')
        .insert({ tenant_id: tenantId, key_hash: keyHash, label: 'default' })
        .select('id, label, is_active, created_at, last_used_at')
        .single()

      if (keyInsertError) {
        return respondError('internal_error', 'Failed to create API key: ' + keyInsertError.message, 500, undefined, rl)
      }

      // Seed 1000 free credits
      await supabase
        .from('credit_balances')
        .insert({ tenant_id: tenantId, balance: 1000 })

      await supabase
        .from('credit_transactions')
        .insert({ tenant_id: tenantId, amount: 1000, balance_after: 1000, transaction_type: 'signup_bonus', description: 'Welcome to Neura — 1000 free credits' })

      return respond({
        user: { id: user.id, email: user.email, tenant_id: tenantId, plan: 'free', created_at: new Date().toISOString() },
        api_key: newKey,
        raw_key: newRawKey,
        credits: 1000,
      }, 200, undefined, rl)
    }

    // Check if user already has an API key
    const { data: existingKeys, error: keyError } = await supabase
      .from('api_keys')
      .select('id, label, is_active, created_at, last_used_at')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: true })
      .limit(1)

    // If no API key exists, generate one now (first-time access)
    let apiKey = existingKeys?.[0] || null
    let rawKey: string | undefined

    if (!apiKey) {
      // Generate a new API key
      rawKey = `sk-${crypto.randomBytes(32).toString('hex')}`
      const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')

      const { data: newKey, error: insertError } = await supabase
        .from('api_keys')
        .insert({
          tenant_id: profile.tenant_id,
          key_hash: keyHash,
          label: 'default',
        })
        .select('id, label, is_active, created_at, last_used_at')
        .single()

      if (insertError) {
        return respondError('internal_error', 'Failed to create API key: ' + insertError.message, 500, undefined, rl)
      }

      apiKey = newKey
    }

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
        tenant_id: profile.tenant_id,
        plan: profile.plan,
        created_at: profile.created_at,
      },
      api_key: apiKey,
      raw_key: rawKey, // only set on first access, undefined on subsequent calls
      credits: credits?.balance || 0,
    }, 200, undefined, rl)
  } catch (err: any) {
    console.error('GET /api/auth/me error:', err)
    return respondError('internal_error', err.message, 500, undefined, rl)
  }
}
