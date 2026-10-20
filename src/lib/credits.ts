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
import { getCreditCost } from './pricing'

export { getCreditCost } from './pricing'

export interface CreditResult {
  allowed: boolean
  balance: number
  cost: number
  reason?: string
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

/** Fire the `credits.low` webhook when the balance falls to or below this. */
export const CREDITS_LOW_THRESHOLD = parseInt(process.env.CREDITS_LOW_THRESHOLD || '100', 10)

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
    // No balance row — the tenant has no credits. Do not self-grant.
    return { allowed: false, balance: 0, cost }
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
  referenceId?: string,
  amountOverride?: number,
  descriptionOverride?: string
): Promise<number | null> {
  const cost = amountOverride ?? getCreditCost(method, pathname)
  if (cost === 0) return null

  const { data, error } = await supabase
    .rpc('deduct_credits', {
      p_tenant_id: tenantId,
      p_amount: cost,
      p_description: descriptionOverride ?? `${method} ${pathname}`,
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
