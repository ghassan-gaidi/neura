/**
 * Quick test for autoPay feature in the TypeScript SDK.
 * Tests that the types and logic compile/can be constructed.
 */

// Test 1: NeuraHttpError with x402
import { NeuraHttpError } from '../dist/index.js'

const x402Error = {
  code: 'payment_required',
  message: 'Insufficient credits',
  x402: {
    chain: 'base',
    token: 'USDC',
    amount: '1.00',
    recipient: '0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef',
    description: '1000 Neura credits',
    credits: 1000,
  },
}

const err = new NeuraHttpError(402, x402Error)
console.log('✓ x402 error created')
console.log('  chain:', err.x402?.chain)
console.log('  amount:', err.x402?.amount)
console.log('  credits:', err.x402?.credits)

// Test 2: autoPay constructor options
import { Neura } from '../dist/index.js'

// Callback mode (no ethers needed)
const neura1 = new Neura({
  apiKey: 'sk-test',
  autoPay: {
    onPaymentRequired: async (x402) => {
      console.log('  would pay:', x402.amount, 'USDC to', x402.recipient)
      return '0xmocktxhash'
    },
  },
})
console.log('✓ autoPay with callback works')

// Private key mode (requires ethers at runtime)
const neura2 = new Neura({
  apiKey: 'sk-test',
  autoPay: {
    privateKey: '0x' + '1'.repeat(64),
    rpcUrl: 'https://mainnet.base.org',
  },
})
console.log('✓ autoPay with privateKey works')

console.log('\nAll autoPay construction tests passed!')
