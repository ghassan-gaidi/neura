// ============================================================
// Neura SDK — Autonomous Payment Handler
// ============================================================
//
// When the API returns 402 Payment Required, the SDK can
// automatically send USDC on Base and retry the request.
//
// Two modes:
//   1. Callback — provide onPaymentRequired, SDK handles verification + retry
//   2. Private key — provide privateKey, SDK sends USDC + verifies + retries

import type { X402Details, AutoPayOptions } from './types'

const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const ERC20_TRANSFER_SIG = '0xa9059cbb' // transfer(address,uint256)

/**
 * Handle a 402 payment-required response.
 * Tries to pay automatically based on the configured autoPay options.
 * Returns the transaction hash if payment was sent, or null if payment can't be made.
 */
export async function handlePaymentRequired(
  autoPay: AutoPayOptions,
  x402: X402Details
): Promise<string | null> {
  // Mode 1: Callback
  if (autoPay.onPaymentRequired) {
    return await autoPay.onPaymentRequired(x402)
  }

  // Mode 2: Private key — send USDC directly
  if (autoPay.privateKey) {
    return await sendUsdcPayment(autoPay.privateKey, x402, autoPay.rpcUrl)
  }

  // No autoPay configured — can't pay
  return null
}

/**
 * Send USDC on Base using a private key.
 * Uses ethers v6 if available, otherwise falls back to raw RPC calls.
 */
async function sendUsdcPayment(
  privateKey: string,
  x402: X402Details,
  rpcUrl?: string
): Promise<string> {
  const rpc = rpcUrl || 'https://mainnet.base.org'

  // Try using ethers (must be installed separately)
  try {
    return await sendViaEthers(privateKey, x402, rpc)
  } catch (err: unknown) {
    if (err instanceof Error && err.message.includes('Cannot find module')) {
      throw new Error(
        'ethers is required for autoPay with privateKey. Install it: npm install ethers\n' +
        'Alternatively, use onPaymentRequired callback instead.'
      )
    }
    throw err
  }
}

/**
 * Send USDC via ethers v6.
 */
async function sendViaEthers(
  privateKey: string,
  x402: X402Details,
  rpcUrl: string
): Promise<string> {
  // Dynamic import — ethers is an optional peer dependency
  const { ethers } = await import('ethers')

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(privateKey, provider)

  // USDC has 6 decimal places
  const amountRaw = ethers.parseUnits(x402.amount, 6)

  // ERC20 transfer call
  const usdcInterface = new ethers.Interface([
    'function transfer(address to, uint256 amount) returns (bool)',
  ])
  const data = usdcInterface.encodeFunctionData('transfer', [x402.recipient, amountRaw])

  // Send transaction
  const tx = await wallet.sendTransaction({
    to: USDC_CONTRACT,
    data,
    // Gas limits — wallet.sendTransaction estimates automatically
  })

  // Wait for 2 confirmations
  const receipt = await tx.wait(2)

  if (!receipt || receipt.status === 0) {
    throw new Error(`USDC transfer failed: transaction reverted`)
  }

  return receipt.hash
}

/**
 * Wait for a transaction to have enough confirmations.
 * Used after the agent sends a payment but before calling verify.
 */
export async function waitForConfirmations(
  txHash: string,
  minConfirmations: number = 2,
  rpcUrl?: string,
  maxWaitMs: number = 60_000
): Promise<void> {
  const rpc = rpcUrl || 'https://mainnet.base.org'
  const startTime = Date.now()

  while (Date.now() - startTime < maxWaitMs) {
    try {
      // Get current block
      const blockRes = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 }),
      })
      const blockData = await blockRes.json()
      const currentBlock = parseInt(blockData.result, 16)

      // Get tx receipt
      const receiptRes = await fetch(rpc, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_getTransactionReceipt',
          params: [txHash],
          id: 2,
        }),
      })
      const receiptData = await receiptRes.json()
      const receipt = receiptData.result

      if (receipt) {
        const txBlock = parseInt(receipt.blockNumber, 16)
        const confirmations = currentBlock - txBlock + 1

        if (confirmations >= minConfirmations) {
          return
        }
      }
    } catch {
      // Ignore RPC errors and retry
    }

    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  throw new Error(`Transaction ${txHash} did not reach ${minConfirmations} confirmations within ${maxWaitMs / 1000}s`)
}
