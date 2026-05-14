#!/usr/bin/env node
/**
 * Payment Poller — watches for incoming USDC transfers to the Neura wallet
 * and credits the appropriate agents.
 * 
 * Run as a cron job: every 5 minutes
 *   node scripts/poll-payments.js
 * 
 * Or via Vercel Cron Jobs (crons.json):
 *   "*/5 * * * *": "/api/payments/poll"
 * 
 * Environment variables needed:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PAYMENT_WALLET_ADDRESS
 *   BASESCAN_API_KEY (recommended) or BASE_RPC_URL
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const WALLET = process.env.PAYMENT_WALLET_ADDRESS || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef'
const BASESCAN_KEY = process.env.BASESCAN_API_KEY
const RPC_URL = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const { createClient } = require('@supabase/supabase-js')
const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase()

async function main() {
  console.log(`[${new Date().toISOString()}] Polling for payments to ${WALLET}...`)

  let transfers = []

  if (BASESCAN_KEY) {
    transfers = await pollBasescan()
  } else {
    transfers = await pollRpc()
  }

  if (transfers.length === 0) {
    console.log('  No new transfers found.')
    return
  }

  console.log(`  Found ${transfers.length} new transfer(s).`)

  for (const tx of transfers) {
    try {
      // Check if already redeemed
      const { data: existing } = await supabase
        .from('credit_transactions')
        .select('id')
        .eq('reference_id', tx.hash)
        .limit(1)

      if (existing?.length) {
        console.log(`  Skipping ${tx.hash.slice(0, 10)}... (already redeemed)`)
        continue
      }

      // We don't know which tenant this is for — log it for manual matching
      // In production, agents include their tenant_id in the tx data field
      console.log(`\n  *** UNCREDITED PAYMENT ***`)
      console.log(`  Tx:      ${tx.hash}`)
      console.log(`  From:    ${tx.from}`)
      console.log(`  Amount:  ${tx.amount} USDC`)
      console.log(`  Block:   ${tx.blockNumber}`)
      console.log(`  Action:  Manual review needed — ask sender their API key`)
      console.log(`  Link:    https://basescan.org/tx/${tx.hash}\n`)

    } catch (err) {
      console.error(`  Error processing ${tx.hash}:`, err.message)
    }
  }
}

async function pollBasescan() {
  const url = `https://api.basescan.org/api?module=account&action=tokentx&address=${WALLET}&contractaddress=${USDC_CONTRACT}&sort=desc&apikey=${BASESCAN_KEY}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== '1' || !data.result) return []

  const now = Math.floor(Date.now() / 1000)
  const fiveMinAgo = now - 300

  return data.result
    .filter((tx: any) => tx.to?.toLowerCase() === WALLET.toLowerCase())
    .filter((tx: any) => parseInt(tx.timeStamp) > fiveMinAgo)
    .map((tx: any) => ({
      hash: tx.hash,
      from: tx.from,
      amount: (parseInt(tx.value) / 1_000_000).toFixed(2),
      blockNumber: parseInt(tx.blockNumber),
      timestamp: parseInt(tx.timeStamp),
    }))
}

async function pollRpc() {
  // RPC polling is more complex — need to scan recent blocks
  // This is a simplified version that checks the last 10 blocks
  try {
    const blockRes = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      }),
    })
    const blockData = await blockRes.json()
    const currentBlock = parseInt(blockData.result, 16)

    const transfers = []
    const walletAddr = WALLET.toLowerCase().replace('0x', '').padStart(64, '0')

    // Check last 20 blocks for Transfer events
    for (let block = currentBlock - 20; block < currentBlock; block++) {
      const logRes = await fetch(RPC_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getLogs',
          params: [{
            fromBlock: `0x${block.toString(16)}`,
            toBlock: `0x${(block + 1).toString(16)}`,
            address: USDC_CONTRACT,
            topics: [
              '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
              null,
              `0x000000000000000000000000${walletAddr}`,
            ],
          }],
          id: 1,
        }),
      })
      const logData = await logRes.json()
      if (logData.result) {
        for (const log of logData.result) {
          const amountRaw = parseInt(log.data, 16)
          const sender = '0x' + log.topics[1].slice(26)
          transfers.push({
            hash: log.transactionHash,
            from: sender,
            amount: (amountRaw / 1_000_000).toFixed(2),
            blockNumber: block,
          })
        }
      }
    }

    return transfers
  } catch (err) {
    console.error('RPC poll error:', err.message)
    return []
  }
}

main().catch(console.error)
