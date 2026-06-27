// ============================================================
// Neura SDK — Main Entry Point
// ============================================================
//
// Usage:
//   import { Neura } from 'neura'
//   const neura = new Neura({ apiKey: 'sk-...' })
//
//   // Store and search memories
//   await neura.memory.create({ content: 'User prefers dark mode', tags: ['preference'] })
//   const results = await neura.memory.search('What are my preferences?')
//
//   // Batch operations
//   await neura.memory.batchCreate([
//     { content: 'Fact 1' },
//     { content: 'Fact 2' },
//   ])
//
//   // Manage agent state
//   await neura.state.set('current_goal', { task: 'Build the API' })
//   const goal = await neura.state.get('current_goal')
//
//   // Webhooks
//   await neura.webhooks.create({ url: 'https://...', events: ['memory.created'] })
//
//   // Admin
//   const keys = await neura.admin.listKeys()
//   await neura.admin.revokeKey(keyId)
//
//   // Credits
//   const balance = await neura.credits.balance()
//
//   // Autonomous payments (when credits run out)
//   const neuraAuto = new Neura({
//     apiKey: 'sk-...',
//     autoPay: {
//       privateKey: '0x...',  // Base wallet private key (requires ethers)
//       onPaymentRequired: async (x402) => {
//         return '0x...'  // tx hash
//       }
//     }
//   })

import { HttpClient, NeuraHttpError } from './client'
import { MemoryAPI } from './memory'
import { StateAPI } from './state'
import { WebhookAPI } from './webhook'
import { AdminAPI, CreditsAPI } from './admin'
import type { NeuraOptions } from './types'

/**
 * Neura — External Brain for AI Agents
 * 
 * Gives AI agents persistent memory, state, webhooks, and admin capabilities
 * via a simple HTTP API.
 */
export class Neura {
  /** Memory operations — store, search, batch, update, delete, share */
  public memory: MemoryAPI
  /** State operations — key-value persistent storage */
  public state: StateAPI
  /** Webhook operations — register, list, manage webhook endpoints */
  public webhooks: WebhookAPI
  /** Admin operations — API keys, transactions, usage stats */
  public admin: AdminAPI
  /** Credits operations — check balance */
  public credits: CreditsAPI
  /** Low-level HTTP client (access for advanced use) */
  public http: HttpClient

  constructor(options: NeuraOptions) {
    this.http = new HttpClient(options)
    this.memory = new MemoryAPI(this.http)
    this.state = new StateAPI(this.http)
    this.webhooks = new WebhookAPI(this.http)
    this.admin = new AdminAPI(this.http)
    this.credits = new CreditsAPI(this.http)
  }
}

// Re-export types and errors
export type {
  NeuraOptions, Memory, StateEntry,
  CreateMemoryInput, UpdateMemoryInput, SearchMemoryInput, SearchFilters,
  BatchCreateResult, BatchDeleteResult, SummarizeResult,
  Webhook, CreateWebhookInput, WebhookEvent,
  ApiKeyMeta, ApiKeyCreateResult, Transaction, UsageStats, CreditsBalance,
  ApiResponse, RateLimitInfo, AutoPayOptions, X402Details,
} from './types'
export { NeuraHttpError }
