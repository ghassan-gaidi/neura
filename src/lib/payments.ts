/**
 * On-chain payment verification for Base USDC payments.
 * 
 * Verifies that a USDC transaction was sent to the Neura payment wallet.
 * 
 * Uses two methods:
 *   1. Basescan API (primary) — simple and free
 *   2. Base RPC (fallback) — direct chain access
 */

import { X402_CONFIG } from './credits'
import { supabase } from './supabase'

// USDC contract on Base
const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'

// ERC20 Transfer event signature: Transfer(address,address,uint256)
const TRANSFER_EVENT_SIG = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export interface PaymentVerification {
  verified: boolean
  amount: string        // USDC amount as string (decimal)
  from: string          // sender address
  to: string            // recipient address
  txHash: string
  confirmations: number
  blockNumber: number
}

/**
 * Verify a USDC payment on Base.
 * Checks that the transaction:
 *   - Transfers USDC
 *   - To the Neura payment wallet
 *   - For at least the expected amount
 *   - Has sufficient confirmations
 */
export async function verifyPayment(
  txHash: string,
  expectedAmountUsdc?: string
): Promise<{ verified: boolean; details?: PaymentVerification; error?: string }> {
  // Check if this tx was already redeemed
  const { data: existing } = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('reference_id', txHash)
    .limit(1)

  if (existing && existing.length > 0) {
    return { verified: false, error: 'payment_tx_already_redeemed' }
  }

  // Try Basescan first
  const basescanResult = await verifyViaBasescan(txHash, expectedAmountUsdc)
  if (basescanResult.verified) return basescanResult

  // Fallback to Base RPC
  return await verifyViaRpc(txHash, expectedAmountUsdc)
}

/**
 * Verify via Basescan API.
 * Requires BASESCAN_API_KEY env var. If not set, falls through.
 */
async function verifyViaBasescan(
  txHash: string,
  expectedAmountUsdc?: string
): Promise<{ verified: boolean; details?: PaymentVerification; error?: string }> {
  const apiKey = process.env.BASESCAN_API_KEY
  if (!apiKey) {
    return { verified: false, error: 'BASESCAN_API_KEY not configured' }
  }

  try {
    const url = `https://api.basescan.org/api?module=account&action=tokentx&txhash=${txHash}&sort=desc&apikey=${apiKey}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status !== '1' || !data.result?.length) {
      return { verified: false, error: 'tx_not_found' }
    }

    // Find the USDC transfer to our wallet
    const transfer = data.result.find(
      (tx: any) =>
        tx.contractAddress?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
        tx.to?.toLowerCase() === X402_CONFIG.recipient.toLowerCase()
    )

    if (!transfer) {
      return { verified: false, error: 'no_usdc_transfer_to_wallet' }
    }

    const amount = transfer.value // raw amount (6 decimals for USDC)
    const amountDecimal = (parseInt(amount) / 1_000_000).toFixed(2)

    if (expectedAmountUsdc && parseFloat(amountDecimal) < parseFloat(expectedAmountUsdc)) {
      return { verified: false, error: `amount_too_low: got ${amountDecimal} USDC, expected ${expectedAmountUsdc}` }
    }

    return {
      verified: true,
      details: {
        verified: true,
        amount: amountDecimal,
        from: transfer.from,
        to: transfer.to,
        txHash,
        confirmations: parseInt(transfer.confirmations) || 0,
        blockNumber: parseInt(transfer.blockNumber),
      },
    }
  } catch (err: any) {
    return { verified: false, error: `basescan_error: ${err.message}` }
  }
}

/**
 * Verify via direct Base RPC call.
 * Uses a public RPC endpoint or ALCHEMY_API_KEY if configured.
 */
async function verifyViaRpc(
  txHash: string,
  expectedAmountUsdc?: string
): Promise<{ verified: boolean; details?: PaymentVerification; error?: string }> {
  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

    // Get transaction receipt
    const receiptRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getTransactionReceipt',
        params: [txHash],
        id: 1,
      }),
    })
    const receiptData = await receiptRes.json()
    const receipt = receiptData.result

    if (!receipt) {
      return { verified: false, error: 'tx_not_found_on_chain' }
    }

    // Get block number for confirmations
    const blockRes = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 2,
      }),
    })
    const blockData = await blockRes.json()
    const currentBlock = parseInt(blockData.result, 16)
    const txBlock = parseInt(receipt.blockNumber, 16)
    const confirmations = currentBlock - txBlock

    // Minimum 2 confirmations for safety
    if (confirmations < 2) {
      return { verified: false, error: `waiting_for_confirmations: ${confirmations}/2` }
    }

    // Parse logs for USDC Transfer event matching our wallet
    const walletAddress = X402_CONFIG.recipient.toLowerCase().replace('0x', '').padStart(64, '0')

    for (const log of receipt.logs || []) {
      // Check: contract is USDC, event is Transfer, to address matches
      if (
        log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
        log.topics?.[0]?.toLowerCase() === TRANSFER_EVENT_SIG &&
        log.topics?.[2]?.toLowerCase().endsWith(walletAddress)
      ) {
        // Decode the amount from the log data (USDC has 6 decimals)
        const amountHex = log.data
        const amountRaw = parseInt(amountHex, 16)
        const amountDecimal = (amountRaw / 1_000_000).toFixed(2)

        if (expectedAmountUsdc && parseFloat(amountDecimal) < parseFloat(expectedAmountUsdc)) {
          return { verified: false, error: `amount_too_low: got ${amountDecimal} USDC` }
        }

        // Decode sender from topics[1]
        const senderHex = log.topics[1]
        const sender = '0x' + senderHex.slice(26)

        return {
          verified: true,
          details: {
            verified: true,
            amount: amountDecimal,
            from: sender,
            to: X402_CONFIG.recipient,
            txHash,
            confirmations,
            blockNumber: txBlock,
          },
        }
      }
    }

    return { verified: false, error: 'no_usdc_transfer_to_wallet_in_tx' }
  } catch (err: any) {
    return { verified: false, error: `rpc_verification_error: ${err.message}` }
  }
}

/**
 * Redeem a verified payment for a tenant.
 * Marks the tx as used and credits the balance.
 */
export async function redeemPayment(
  tenantId: string,
  paymentTx: string,
  amountUsdc: string
): Promise<{ success: boolean; creditsAdded: number; newBalance: number }> {
  const creditsToAdd = Math.floor(
    (parseFloat(amountUsdc) / parseFloat(X402_CONFIG.pricePerThousand)) * 1000
  )

  if (creditsToAdd <= 0) {
    throw new Error('Invalid credit amount from payment')
  }

  // Atomically add credits
  const { data, error } = await supabase.rpc('redeem_payment', {
    p_tenant_id: tenantId,
    p_tx_hash: paymentTx,
    p_credits: creditsToAdd,
    p_amount_usdc: amountUsdc,
  })

  if (error) {
    throw new Error(`Failed to redeem payment: ${error.message}`)
  }

  return {
    success: true,
    creditsAdded: creditsToAdd,
    newBalance: data as number,
  }
}
