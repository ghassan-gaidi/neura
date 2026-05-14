/**
 * Tests on-chain payment verification against a real Base RPC.
 * Fetches a recent USDC transfer, then runs the verification module against it.
 */
const BASE_RPC = 'https://mainnet.base.org'
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const WALLET = process.argv[2] || '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef'
const TRANSFER_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

async function rpcCall(method, params) {
  const res = await fetch(BASE_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  })
  return (await res.json()).result
}

async function main() {
  console.log('1. Checking Base RPC connectivity...')
  const blockNum = await rpcCall('eth_blockNumber', [])
  const currentBlock = parseInt(blockNum, 16)
  console.log(`   Current block: ${currentBlock} (${blockNum})\n`)

  // Find a recent USDC transfer for testing
  console.log('2. Fetching recent USDC transfers...')
  const logs = await rpcCall('eth_getLogs', [{
    fromBlock: '0x' + (currentBlock - 50).toString(16),
    toBlock: 'latest',
    address: USDC_CONTRACT,
    topics: [TRANSFER_SIG],
  }])

  if (!logs || logs.length === 0) {
    console.log('   No recent transfers found. Trying a wider range...')
    // Try wider range
    const widerLogs = await rpcCall('eth_getLogs', [{
      fromBlock: '0x' + (currentBlock - 500).toString(16),
      toBlock: 'latest',
      address: USDC_CONTRACT,
      topics: [TRANSFER_SIG, null, null],
      limit: 5,
    }])
    logs = widerLogs || []
  }

  const sampleTxs = logs.slice(0, 3)
  console.log(`   Found ${logs.length} recent transfers, showing ${sampleTxs.length}:\n`)

  for (const log of sampleTxs) {
    const from = '0x' + log.topics[1].slice(26)
    const to = '0x' + log.topics[2].slice(26)
    const amount = parseInt(log.data, 16) / 1_000_000
    console.log(`   Tx:      ${log.transactionHash}`)
    console.log(`   From:    ${from}`)
    console.log(`   To:      ${to}`)
    console.log(`   Amount:  ${amount.toFixed(2)} USDC`)
    console.log(`   Block:   ${parseInt(log.blockNumber, 16)}`)
    console.log()
  }

  // Test verification against the first tx
  if (sampleTxs.length > 0) {
    const testTx = sampleTxs[0].transactionHash
    console.log(`3. Testing verification against ${testTx.slice(0, 20)}...\n`)

    // Get the transaction receipt
    const receipt = await rpcCall('eth_getTransactionReceipt', [testTx])
    if (receipt) {
      const txBlock = parseInt(receipt.blockNumber, 16)
      const confirmations = currentBlock - txBlock
      console.log(`   Block:        ${txBlock}`)
      console.log(`   Confirmations: ${confirmations}`)
      console.log(`   Logs:         ${receipt.logs.length}`)

      // Find USDC transfer to wallet
      const walletAddr = WALLET.toLowerCase().replace('0x', '').padStart(64, '0')
      const matchingLog = receipt.logs.find(l =>
        l.address?.toLowerCase() === USDC_CONTRACT &&
        l.topics?.[0]?.toLowerCase() === TRANSFER_SIG
      )

      if (matchingLog) {
        const toAddr = '0x' + matchingLog.topics[2].slice(26)
        const amt = parseInt(matchingLog.data, 16) / 1_000_000
        console.log(`   USDC Transfer: ${amt.toFixed(2)} USDC → ${toAddr}`)

        if (toAddr.toLowerCase() === WALLET.toLowerCase()) {
          console.log(`   ✓ MATCH: Payment to our wallet verified!`)
        } else {
          console.log(`   ℹ Different recipient (not our wallet)`)
        }
      } else {
        console.log(`   ℹ No USDC transfer event in this tx`)
      }
    }
  }

  // Test our wallet for any existing transfers
  console.log(`\n4. Checking for existing transfers to our wallet (${WALLET.slice(0, 10)}...)...`)
  const walletAddrPadded = WALLET.toLowerCase().replace('0x', '').padStart(64, '0')
  const ourLogs = await rpcCall('eth_getLogs', [{
    fromBlock: '0x' + (currentBlock - 10000).toString(16),
    toBlock: 'latest',
    address: USDC_CONTRACT,
    topics: [TRANSFER_SIG, null, '0x000000000000000000000000' + walletAddrPadded],
  }])

  if (ourLogs && ourLogs.length > 0) {
    console.log(`   Found ${ourLogs.length} incoming transfer(s) to wallet!`)
    for (const log of ourLogs.slice(0, 3)) {
      const from = '0x' + log.topics[1].slice(26)
      const amount = parseInt(log.data, 16) / 1_000_000
      console.log(`   ${amount.toFixed(2)} USDC from ${from.slice(0, 10)}... (tx: ${log.transactionHash.slice(0, 16)}...)`)
    }
  } else {
    console.log('   No incoming transfers to wallet yet. (Expected — nobody has paid yet.)')
  }

  console.log(`\n✓ RPC verification test complete`)
}

main().catch(err => { console.error('Error:', err); process.exit(1) })
