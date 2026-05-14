/**
 * On-chain payment verification for Base USDC payments.
 * 
 * Verifies that a USDC transaction was sent to the Neura payment wallet.
 * Uses direct Base RPC calls — no third-party API dependency.
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
 * Verify a USDC payment on Base by checking the transaction receipt directly.
 * No API key needed — uses the public Base RPC.
 * 
 * Checks:
 *   - Tx has a USDC Transfer event matching our wallet
 *   - Amount meets the expected minimum
 *   - At least 2 confirmations
 *   - Not already redeemed
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

  return await verifyViaRpc(txHash, expectedAmountUsdc)
}

/**
 * Verify via direct Base RPC call.
 * Parses ERC20 Transfer event logs from the transaction receipt.
 */
async function verifyViaRpc(
  txHash: string,
  expectedAmountUsdc?: string
): Promise<{ verified: boolean; details?: PaymentVerification; error?: string }> {
  try {
    const rpcUrl = process.env.BASE_RPC_URL || 'https://mainnet.base.org'

    // Get current block number for confirmations
    const [blockRes, receiptRes] = await Promise.all([
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1,
        }),
      }),
      fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0', method: 'eth_getTransactionReceipt', params: [txHash], id: 2,
        }),
      }),
    ])

    const blockData = await blockRes.json()
    const receiptData = await receiptRes.json()
    const receipt = receiptData.result

    if (!receipt) {
      return { verified: false, error: 'tx_not_found_on_chain' }
    }

    const currentBlock = parseInt(blockData.result, 16)
    const txBlock = parseInt(receipt.blockNumber, 16)
    const confirmations = currentBlock - txBlock

    if (confirmations < 2) {
      return { verified: false, error: `waiting_for_confirmations: ${confirmations}/2` }
    }

    // Our wallet address padded to 32 bytes for topic matching
    const walletAddressRaw = X402_CONFIG.recipient.toLowerCase().replace('0x', '')
    const walletAddressPadded = '000000000000000000000000' + walletAddressRaw

    // Parse logs for USDC Transfer event to our wallet
    for (const log of receipt.logs || []) {
      if (
        log.address?.toLowerCase() === USDC_CONTRACT.toLowerCase() &&
        log.topics?.[0]?.toLowerCase() === TRANSFER_EVENT_SIG
      ) {
        const toAddress = log.topics[2].toLowerCase()

        if (toAddress.endsWith(walletAddressRaw) || toAddress === '0x' + walletAddressPadded) {
          // Decode amount (USDC has 6 decimal places)
          const amountRaw = parseInt(log.data, 16)
          const amountDecimal = (amountRaw / 1_000_000).toFixed(2)

          if (expectedAmountUsdc && parseFloat(amountDecimal) < parseFloat(expectedAmountUsdc)) {
            return { verified: false, error: `amount_too_low: got ${amountDecimal} USDC` }
          }

          // Decode sender from topics[1]
          const senderHex = log.topics[1].slice(26)
          const sender = '0x' + senderHex

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
    }

    return { verified: false, error: 'no_usdc_transfer_to_wallet_in_tx' }
  } catch (err: any) {
    return { verified: false, error: `rpc_verification_error: ${err.message}` }
  }
}

/**
 * Redeem a verified payment for a tenant.
 * Atomically adds credits and records the transaction.
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
