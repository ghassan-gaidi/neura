import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase'
import { resolveApiKey } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware'
import { respond, respondError } from '@/lib/response'
import { logUsage } from '@/lib/usage'
import { getBalance, X402_CONFIG } from '@/lib/credits'
import { isTestTopUpAllowed, PRICING } from '@/lib/pricing'

/**
 * GET /api/credits
 * Get current credit balance and pricing info.
 */
export async function GET(request: NextRequest) {
    let rl: ReturnType<typeof checkRateLimit> | undefined
try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)

    const balance = await getBalance(auth.tenantId)

    logUsage(auth, 'GET /api/credits')
    return respond({
      balance,
      pricing: {
        ...PRICING,
        'state_operations': 'free',
        'webhooks': 'free',
      },
      top_up: {
        via: X402_CONFIG,
        url: '/api/credits',
        method: 'POST',
        body: { payment_tx: '<base tx hash>', amount_usdc: '<amount>' },
      },
    }, 200, undefined, rl)
  } catch (err: any) {
    console.error('GET /api/credits error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 }, rl)
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
 * This is disabled unless the ALLOW_TEST_TOP_UP environment variable is set to 'true'.
 */
export async function POST(request: NextRequest) {
    let rl: ReturnType<typeof checkRateLimit> | undefined
try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)

    const body = await request.json().catch(() => ({}))

    // Production path: verify on-chain payment
    let creditsToAdd = 0

    if (body.test_top_up) {
      if (!isTestTopUpAllowed()) {
        return respondError('validation_error', 'test_top_up is disabled in production', 400, { action: 'use_payment_tx' }, rl)
      }
      creditsToAdd = body.credits || 1000
    } else if (body.payment_tx) {
      // Verify the transaction on-chain
      const { verifyPayment, redeemPayment } = await import('@/lib/payments')
      const verification = await verifyPayment(body.payment_tx, body.amount_usdc)

      if (!verification.verified) {
        return respondError('payment_required', `Payment not confirmed: ${verification.error}`, 402, {
          action: verification.error?.startsWith('waiting_for_confirmations') ? 'wait_and_retry' : 'check_transaction',
          retry_after: verification.error?.startsWith('waiting_for_confirmations') ? 30 : undefined,
        }, rl)
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
      }, 200, undefined, rl)
    }

    if (creditsToAdd <= 0) {
      return respondError('validation_error', 'Invalid credit amount or missing payment', 400, undefined, rl)
    }

    // Add credits
    const { data: balance } = await supabase
      .from('credit_balances')
      .select('balance')
      .eq('tenant_id', auth.tenantId)
      .single()

    const currentBalance = balance?.balance ?? 1000
    const newBalance = currentBalance + creditsToAdd

    // Add credits. Only touch `balance` — `total_purchased` and
    // `total_consumed` must reflect lifetime history, not the current balance.
    await supabase.from('credit_balances').upsert({
      tenant_id: auth.tenantId,
      balance: newBalance,
    }, { onConflict: 'tenant_id' })

    // Record transaction
    await supabase.from('credit_transactions').insert({
      tenant_id: auth.tenantId,
      amount: creditsToAdd,
      balance_after: newBalance,
      transaction_type: 'bonus',
      description: `Top-up: +${creditsToAdd} credits`,
      reference_id: body.payment_tx || null,
    })

    logUsage(auth, 'POST /api/credits/top-up')
    return respond({
      credits_added: creditsToAdd,
      balance: newBalance,
      payment_tx: body.payment_tx || null,
    }, 200, undefined, rl)
  } catch (err: any) {
    console.error('POST /api/credits/top-up error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 }, rl)
  }
}
