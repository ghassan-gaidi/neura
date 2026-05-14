import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { getBalance, X402_CONFIG } from '@/lib/credits'

/**
 * GET /api/credits
 * Get current credit balance and pricing info.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const balance = await getBalance(auth.tenantId)

    logUsage(auth, 'GET /api/credits')
    return respond({
      balance,
      pricing: {
        'POST /api/memory': 1,
        'GET /api/memory': 1,
        'POST /api/memory/search': 2,
        'POST /api/memory/summarize': 5,
        'state_operations': 'free',
        'webhooks': 'free',
      },
      top_up: {
        via: X402_CONFIG,
        url: '/api/credits/top-up',
      },
    }, 200)
  } catch (err: any) {
    console.error('GET /api/credits error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}

/**
 * POST /api/credits/top-up
 * Top up credits. Simulates a payment confirmation.
 * In production, this verifies an on-chain USDC payment.
 * 
 * Body: { payment_tx?: string, amount_usdc?: string, credits?: number }
 * 
 * For testing: send { test_top_up: true, credits: 1000 } to add free credits.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) })

    const body = await request.json().catch(() => ({}))

    // Production path: verify on-chain payment
    let creditsToAdd = 0
    let verifiedPayment = false

    if (body.test_top_up) {
      creditsToAdd = body.credits || 1000
      verifiedPayment = true
    } else if (body.payment_tx) {
      // Verify the transaction on-chain
      const { verifyPayment, redeemPayment } = await import('@/lib/payments')
      const verification = await verifyPayment(body.payment_tx, body.amount_usdc)

      if (!verification.verified) {
        return respondError('payment_required', `Payment not confirmed: ${verification.error}`, 402, {
          action: verification.error?.startsWith('waiting_for_confirmations') ? 'wait_and_retry' : 'check_transaction',
          retry_after: verification.error?.startsWith('waiting_for_confirmations') ? 30 : undefined,
        })
      }

      // Redeem through the atomic function
      const result = await redeemPayment(
        auth.tenantId,
        body.payment_tx,
        verification.details!.amount
      )

      logUsage(auth, 'POST /api/credits/top-up')
      return respond({
        credits_added: result.creditsAdded,
        balance: result.newBalance,
        payment_tx: body.payment_tx,
        amount_usdc: verification.details!.amount,
        from: verification.details!.from,
        confirmations: verification.details!.confirmations,
      }, 200)
    }

    if (creditsToAdd <= 0) {
      return respondError('validation_error', 'Invalid credit amount or missing payment', 400)
    }

    // Add credits
    const { data: balance } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('tenant_id', auth.tenantId)
      .single()

    const currentBalance = balance?.balance ?? 1000
    const newBalance = currentBalance + creditsToAdd

    await supabase.from('credit_balances').upsert({
      tenant_id: auth.tenantId,
      balance: newBalance,
      total_purchased: currentBalance, // Preserve total purchased
    }, { onConflict: 'tenant_id' })

    // Record transaction
    await supabase.from('credit_transactions').insert({
      tenant_id: auth.tenantId,
      amount: creditsToAdd,
      balance_after: newBalance,
      transaction_type: body.test_top_up ? 'bonus' : 'purchase',
      description: `Top-up: +${creditsToAdd} credits`,
      reference_id: body.payment_tx || null,
    })

    logUsage(auth, 'POST /api/credits/top-up')
    return respond({
      credits_added: creditsToAdd,
      balance: newBalance,
      payment_tx: body.payment_tx || null,
    }, 200)
  } catch (err: any) {
    console.error('POST /api/credits/top-up error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
