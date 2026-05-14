#!/usr/bin/env node
/**
 * Payment Poller — CLI version for local/self-hosted use.
 * Checks for uncredited USDC transfers via Base RPC.
 * 
 * Usage:
 *   node scripts/poll-payments.mjs
 * 
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY env vars
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WALLET = (process.env.PAYMENT_WALLET_ADDRESS || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef').toLowerCase()
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase()
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function rpcCall(method, params) {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
  return (await res.json()).result
}

async function main() {
  console.log(`[${new Date().toISOString()}] Polling for payments to ${WALLET}...`)

  const currentBlock = parseInt(await rpcCall('eth_blockNumber', []), 16)
  const walletPadded = '000000000000000000000000' + WALLET.replace('0x', '')
  const fromBlock = '0x' + Math.max(currentBlock - 500, 0).toString(16)

  const logs = await rpcCall('eth_getLogs', [{
    fromBlock, toBlock: 'latest',
    address: USDC_CONTRACT,
    topics: [TRANSFER_SIG, null, '0x' + walletPadded],
  }])

  if (!logs || logs.length === 0) {
    console.log('  No new transfers found.')
    return
  }

  for (const log of logs) {
    const { data: existing } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', log.transactionHash)
      .limit(1)

    if (existing?.length) {
      console.log(`  Skipping ${log.transactionHash.slice(0, 10)}... (already redeemed)`)
      continue
    }

    const sender = '0x' + log.topics[1].slice(26)
    const amount = (parseInt(log.data, 16) / 1_000_000).toFixed(2)

    console.log(`\n  *** UNCREDITED PAYMENT ***`)
    console.log(`  Tx:      ${log.transactionHash}`)
    console.log(`  From:    ${sender}`)
    console.log(`  Amount:  ${amount} USDC`)
    console.log(`  Block:   ${parseInt(log.blockNumber, 16)}`)
    console.log(`  Action:  Ask the sender for their API key to credit`)
    console.log(`  Link:    https://basescan.org/tx/${log.transactionHash}\n`)
  }
}

main().catch(console.error)
