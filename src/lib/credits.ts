/**
 * Credit tracking and payment system.
 * 
 * Every API call costs credits. When credits run out, the API returns
 * HTTP 402 with payment details via the x402 protocol.
 * 
 * Pricing:
 *   - Memory create:     1 credit
 *   - Memory search:     1 credit
 *   - Advanced search:   2 credits
 *   - Memory update:     1 credit
 *   - Memory delete:     0 credits (free)
 *   - Memory summarize:  5 credits
 *   - State operations:  0 credits (free)
 *   - Webhook CRUD:      0 credits (admin, free)
 */

import { supabase } from './supabase'

export interface CreditResult {
  allowed: boolean
  balance: number
  cost: number
  reason?: string
}

export interface PricingTier {
  [endpoint: string]: number
}

/** Free tier limits */
export const FREE_TIER = {
  /** Max memories per tenant */
  maxMemories: 100,
  /** Free credits on signup */
  signupCredits: 1000,
  /** Rate limit: requests per 60s */
  rateLimit: 100,
} as const

const PRICING: PricingTier = {
  'POST /api/memory': 1,
  'GET /api/memory': 1,
  'POST /api/memory/search': 2,
  'PATCH /api/memory': 1,
  'DELETE /api/memory': 0,
  'POST /api/memory/summarize': 5,
  'POST /api/state': 0,
  'GET /api/state': 0,
  'DELETE /api/state': 0,
  'POST /api/webhooks': 0,
  'GET /api/webhooks': 0,
  'PATCH /api/webhooks': 0,
  'DELETE /api/webhooks': 0,
  'POST /api/memory/:id/share': 0,
  'GET /api/memory/:id/share': 0,
  'DELETE /api/memory/:id/share': 0,
  'GET /api/shared-with-me': 0,
  'POST /api/admin/keys': 0,
  'GET /api/admin/keys': 0,
}

/**
 * Get the credit cost for a given endpoint.
 * Matches by prefix — e.g. 'POST /api/memory' matches both
 * the base route and parameterized routes like '/api/memory/:id'.
 */
export function getCreditCost(method: string, pathname: string): number {
  const key = `${method} ${pathname}`
  
  // Exact match first
  if (PRICING[key] !== undefined) return PRICING[key]
  
  // Prefix match for parameterized routes
  for (const [pattern, cost] of Object.entries(PRICING)) {
    if (key.startsWith(pattern.split(':')[0])) return cost
  }
  
  return 1 // Default: 1 credit
}

/**
 * Check if a tenant has enough credits for an operation.
 * Returns current balance and whether the operation is allowed.
 */
export async function checkCredits(tenantId: string, method: string, pathname: string): Promise<CreditResult> {
  const cost = getCreditCost(method, pathname)
  
  if (cost === 0) {
    return { allowed: true, balance: 0, cost: 0 }
  }

  const { data, error } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) {
    // No balance row — create one with free credits
    await supabase.from('credit_balances').insert({
      tenant_id: tenantId,
      balance: FREE_TIER.signupCredits,
      total_purchased: FREE_TIER.signupCredits,
    })
    return { allowed: true, balance: FREE_TIER.signupCredits, cost }
  }

  return {
    allowed: data.balance >= cost,
    balance: data.balance,
    cost,
  }
}

/**
 * Check if a tenant is within free tier memory limits.
 * Returns { allowed, current, limit } for memory creation.
 */
export async function checkMemoryLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  // Get user plan
  const { data: user } = await supabase
    .from('users')
    .select('plan')
    .eq('tenant_id', tenantId)
    .single()

  const plan = user?.plan || 'free'
  const limit = plan === 'free' ? FREE_TIER.maxMemories : Infinity

  // Count current memories
  const { count } = await supabase
    .from('memories')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  const current = count || 0

  return {
    allowed: current < limit,
    current,
    limit: limit === Infinity ? -1 : limit,
  }
}

/**
 * Deduct credits for an operation.
 * Returns the new balance, or null if insufficient.
 */
export async function deductCredits(
  tenantId: string,
  method: string,
  pathname: string,
  referenceId?: string
): Promise<number | null> {
  const cost = getCreditCost(method, pathname)
  if (cost === 0) return null

  const { data, error } = await supabase
    .rpc('deduct_credits', {
      p_tenant_id: tenantId,
      p_amount: cost,
      p_description: `${method} ${pathname}`,
      p_reference_id: referenceId || null,
    })

  if (error) {
    console.error('Failed to deduct credits:', error.message)
    return null
  }

  return data as number
}

/**
 * Get the current credit balance for a tenant.
 */
export async function getBalance(tenantId: string): Promise<number> {
  const { data } = await supabase
    .from('credit_balances')
    .select('balance')
    .eq('tenant_id', tenantId)
    .single()

  return data?.balance ?? 0
}

/**
 * x402 payment configuration.
 * When credits are exhausted, return 402 with these details.
 */
export const X402_CONFIG = {
  chain: 'base',
  token: 'USDC',
  /** Wallet address where payments are sent */
  recipient: process.env.PAYMENT_WALLET_ADDRESS || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef',
  /** USDC per 1000 credits */
  pricePerThousand: process.env.CREDIT_PRICE_PER_THOUSAND || '1.00',
  /** Minimum credit purchase */
  minTopUp: parseInt(process.env.MIN_TOP_UP_CREDITS || '100', 10),
}

/**
 * Build the 402 response body for an agent.
 */
export function buildX402Response(tenantId: string, endpointCost: number) {
  const creditsNeeded = Math.max(endpointCost, X402_CONFIG.minTopUp) // Minimum top-up
  const usdcAmount = (parseFloat(X402_CONFIG.pricePerThousand) * creditsNeeded) / 1000

  return {
    code: 'payment_required',
    message: 'Insufficient credits. Send USDC to continue.',
    action: 'send_payment',
    retry_after: 60,
    docs_url: 'https://neura.sh/docs/payments',
    x402: {
      chain: X402_CONFIG.chain,
      token: X402_CONFIG.token,
      amount: usdcAmount.toFixed(2),
      recipient: X402_CONFIG.recipient,
      description: `${creditsNeeded} Neura credits`,
      credits: creditsNeeded,
    },
  }
}
