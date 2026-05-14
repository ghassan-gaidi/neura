import { NextRequest } from 'next/server'
import { respond, respondError } from '@/lib/response'
import { verifyPayment, redeemPayment } from '@/lib/payments'

/**
 * POST /api/payments/verify
 * Called by an agent (or external webhook service) to verify and redeem
 * an on-chain USDC payment.
 * 
 * Body:
 *   { payment_tx: "0x...", amount_usdc?: "1.00" }
 * 
 * Agent flow:
 *   1. Agent sends USDC to the configured wallet on Base
 *   2. Agent calls this endpoint with the tx hash
 *   3. We verify the tx on-chain, credit the balance
 * 
 * External service flow (Alchemy/any webhook):
 *   { payment_tx: "...", tx_to: "...", tx_from: "..." }
 */
export async function POST(request: NextRequest) {
  try {
    // This endpoint uses API key auth to identify the tenant
    const { resolveApiKey } = await import('@/lib/auth')
    const { checkRateLimit } = await import('@/lib/middleware')

    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const body = await request.json().catch(() => ({}))
    const txHash = body.payment_tx || body.txHash

    if (!txHash || typeof txHash !== 'string') {
      return respondError('validation_error', 'payment_tx (transaction hash) is required', 400)
    }

    // Verify on-chain
    const verification = await verifyPayment(txHash, body.amount_usdc)

    if (!verification.verified) {
      return respondError('payment_required', `Payment not confirmed: ${verification.error}`, 402, {
        action: verification.error?.startsWith('waiting_for_confirmations') ? 'wait_and_retry' : 'check_transaction',
        retry_after: verification.error?.startsWith('waiting_for_confirmations') ? 30 : undefined,
      })
    }

    // Payment verified — redeem it
    const result = await redeemPayment(
      auth.tenantId,
      txHash,
      verification.details!.amount
    )

    return respond({
      credits_added: result.creditsAdded,
      balance: result.newBalance,
      payment_tx: txHash,
      amount_usdc: verification.details!.amount,
      from: verification.details!.from,
      confirmations: verification.details!.confirmations,
    }, 200)
  } catch (err: any) {
    console.error('POST /api/payments/verify error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
