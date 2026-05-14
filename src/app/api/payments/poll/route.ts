/**
 * GET /api/payments/poll
 * Vercel Cron Job — checks for uncredited USDC transfers via Base RPC.
 * Runs every 5 minutes (configured in vercel.json).
 * 
 * Checks recent blocks for USDC Transfer events to our wallet.
 * No external API needed — direct chain access.
 */
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const WALLET = (process.env.PAYMENT_WALLET_ADDRESS || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef').toLowerCase()
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase()
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

async function rpcCall(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
  return (await res.json()).result
}

export async function GET(request: NextRequest) {
  // Only Vercel Cron or local dev
  if (request.headers.get('x-vercel-cron') !== '1' && process.env.VERCEL_ENV === 'production') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    const currentBlockHex = await rpcCall('eth_blockNumber', [])
    const currentBlock = parseInt(currentBlockHex, 16)
    const walletPadded = '000000000000000000000000' + WALLET.replace('0x', '')

    // Check last 100 blocks (~20 min) for USDC transfers to our wallet
    const fromBlock = '0x' + Math.max(currentBlock - 100, 0).toString(16)
    const logs = await rpcCall('eth_getLogs', [{
      fromBlock,
      toBlock: 'latest',
      address: USDC_CONTRACT,
      topics: [TRANSFER_SIG, null, '0x' + walletPadded],
    }])

    if (!logs || logs.length === 0) {
      return NextResponse.json({
        ok: true,
        wallet: WALLET,
        current_block: currentBlock,
        checked_blocks: 100,
        new_uncredited: [],
        checked_at: new Date().toISOString(),
      })
    }

    // Process each transfer, skip already-redeemed ones
    const newTransfers: Array<{
      hash: string; from: string; amount: string; confirmations: number
    }> = []

    for (const log of logs) {
      const { data: existing } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('reference_id', log.transactionHash)
        .limit(1)

      if (existing?.length) continue

      const sender = '0x' + log.topics[1].slice(26)
      const amount = (parseInt(log.data, 16) / 1_000_000).toFixed(2)
      const txBlock = parseInt(log.blockNumber, 16)

      newTransfers.push({
        hash: log.transactionHash,
        from: sender,
        amount,
        confirmations: currentBlock - txBlock,
      })
    }

    if (newTransfers.length > 0) {
      console.log(`[payment-poll] ${newTransfers.length} uncredited transfer(s):`,
        newTransfers.map(t => `${t.amount} USDC from ${t.from.slice(0,10)}...`).join(', '))
    }

    return NextResponse.json({
      ok: true,
      wallet: WALLET,
      current_block: currentBlock,
      checked_blocks: 100,
      new_uncredited: newTransfers,
      checked_at: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[payment-poll] Error:', err.message)
    return NextResponse.json({ ok: false, error: err.message })
  }
}

export { GET as POST }
