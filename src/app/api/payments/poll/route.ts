/**
 * GET /api/payments/poll
 * Cron job endpoint — checks for uncredited USDC transfers to the wallet.
 * Runs every 5 minutes via Vercel Cron Jobs (vercel.json).
 * 
 * Requires BASESCAN_API_KEY for on-chain lookups.
 * Logs new transfers — manual matching needed for unknown senders.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const WALLET = process.env.PAYMENT_WALLET_ADDRESS || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef'
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

export async function GET(request: NextRequest) {
  // Verify this is a Vercel Cron Job call
  const isCron = request.headers.get('x-vercel-cron') === '1'
  if (!isCron && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const apikey = process.env.BASESCAN_API_KEY
  if (!apikey) {
    console.warn('[payment-poll] BASESCAN_API_KEY not configured')
    return NextResponse.json({ ok: false, error: 'BASESCAN_API_KEY not configured' })
  }

  try {
    // Fetch USDC transfers to the wallet (last 10 min)
    const url = `https://api.basescan.org/api?module=account&action=tokentx&address=${WALLET}&contractaddress=${USDC_CONTRACT}&sort=desc&apikey=${apikey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== '1' || !data.result) {
      return NextResponse.json({ ok: false, error: 'basescan_api_error' })
    }

    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - 600 // 10 minutes
    const newTransfers: Array<{
      hash: string; from: string; amount: string; timestamp: string; confirmations: number
    }> = []

    for (const tx of data.result) {
      // Only inbound transfers to our wallet
      if (tx.to?.toLowerCase() !== WALLET.toLowerCase()) continue
      if (parseInt(tx.timeStamp) < cutoff) continue

      // Check if already redeemed
      const { data: existing } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('reference_id', tx.hash)
        .limit(1)

      if (existing?.length) continue

      newTransfers.push({
        hash: tx.hash,
        from: tx.from,
        amount: (parseInt(tx.value) / 1_000_000).toFixed(2),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        confirmations: parseInt(tx.confirmations) || 0,
      })
    }

    if (newTransfers.length > 0) {
      console.log(`[payment-poll] Found ${newTransfers.length} uncredited transfer(s):`, 
        newTransfers.map(t => `${t.amount} USDC from ${t.from.slice(0,10)}...`).join(', '))
    }

    return NextResponse.json({
      ok: true,
      wallet: WALLET,
      checked_at: new Date().toISOString(),
      new_uncredited: newTransfers,
    })
  } catch (err: any) {
    console.error('[payment-poll] Error:', err.message)
    return NextResponse.json({ ok: false, error: err.message })
  }
}

/**
 * POST — also accept POST for webhook-style calls from external services
 */
export { GET as POST }
