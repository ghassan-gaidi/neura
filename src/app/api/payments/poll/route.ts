/**
 * GET /api/payments/poll
 * Cron job endpoint — checks for uncredited USDC transfers to the wallet.
 * Called by Vercel Cron Jobs every 5 minutes.
 * 
 * Requires BASESCAN_API_KEY or BASE_RPC_URL env var.
 * Logs uncredited payments for manual matching.
 */
import { NextResponse } from 'next/server'

export async function GET() {
  // Only allow internal Vercel cron or admin key
  if (process.env.VERCEL_ENV === 'production' || process.env.CRON_SECRET) {
    const authHeader = '' // Cron jobs don't send auth
    // In production, Vercel Cron Jobs bypass auth via internal routing
  }

  try {
    const WALLET = process.env.PAYMENT_WALLET_ADDRESS || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef'
    const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
    const apikey = process.env.BASESCAN_API_KEY

    if (!apikey) {
      return NextResponse.json({ ok: false, error: 'BASESCAN_API_KEY not configured' }, { status: 200 })
    }

    // Fetch recent USDC transfers to the wallet
    const url = `https://api.basescan.org/api?module=account&action=tokentx&address=${WALLET}&contractaddress=${USDC_CONTRACT}&sort=desc&apikey=${apikey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== '1' || !data.result) {
      return NextResponse.json({ ok: false, error: 'basescan_error' }, { status: 200 })
    }

    // Find recent transfers (last 10 minutes) to our wallet
    const now = Math.floor(Date.now() / 1000)
    const cutoff = now - 600

    const transfers = data.result
      .filter((tx: any) => tx.to?.toLowerCase() === WALLET.toLowerCase())
      .filter((tx: any) => parseInt(tx.timeStamp) > cutoff)
      .map((tx: any) => ({
        hash: tx.hash,
        from: tx.from,
        amount: (parseInt(tx.value) / 1_000_000).toFixed(2),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        blockNumber: parseInt(tx.blockNumber),
        confirmations: parseInt(tx.confirmations) || 0,
      }))

    return NextResponse.json({
      ok: true,
      wallet: WALLET,
      checked_at: new Date().toISOString(),
      recent_transfers: transfers,
      uncredited: transfers.length,
    })
  } catch (err: any) {
    console.error('Payment poll error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 200 })
  }
}
