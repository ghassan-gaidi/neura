// ============================================================
// Neura SDK — Shared Types
// ============================================================

/** Options for creating a Neura client */
export interface NeuraOptions {
  /** API key (sk-...) */
  apiKey: string
  /** Base URL (default: https://neura.sh) */
  baseUrl?: string
  /** Max retries on failure (default: 3) */
  maxRetries?: number
  /**
   * Autonomous payment handling.
   * When the API returns 402 (insufficient credits), the SDK can
   * automatically pay in USDC on Base and retry the request.
   * 
   * Two modes:
   *   1. Callback — you handle sending USDC, SDK handles the rest
   *   2. Private key — SDK sends USDC automatically (requires ethers)
   */
  autoPay?: AutoPayOptions
}

/** x402 payment details from the API */
export interface X402Details {
  chain: string
  token: string
  amount: string
  recipient: string
  description: string
  credits: number
}

/** Configuration for autonomous payment handling */
export interface AutoPayOptions {
  /**
   * Callback invoked when a 402 is received.
   * Send USDC using your own wallet logic and return the tx hash.
   * The SDK then verifies the payment and retries the original request.
   */
  onPaymentRequired?: (x402: X402Details) => Promise<string>
  /**
   * Agent wallet private key (0x...).
   * The SDK will automatically send USDC on Base.
   * Requires ethers v6 to be installed.
   */
  privateKey?: string
  /** Base RPC URL (default: https://mainnet.base.org) */
  rpcUrl?: string
}

/** A stored memory entry */
export interface Memory {
  id: string
  content: string
  metadata?: Record<string, unknown>
  tags?: string[]
  importance: number
  score?: number
  expires_at?: string
  created_at: string
  updated_at: string
}

/** Input for creating a memory */
export interface CreateMemoryInput {
  content: string
  metadata?: Record<string, unknown>
  tags?: string[]
  importance?: number
  expires_at?: string
}

/** Input for updating a memory */
export interface UpdateMemoryInput {
  content?: string
  metadata?: Record<string, unknown>
  tags?: string[]
  importance?: number
}

/** Search filters */
export interface SearchFilters {
  tags?: string[]
  importance_min?: number
  importance_max?: number
  metadata?: Record<string, unknown>
  date_from?: string
  date_to?: string
}

/** Advanced search input */
export interface SearchMemoryInput {
  query?: string
  filters?: SearchFilters
  limit?: number
  min_score?: number
}

/** A state entry */
export interface StateEntry {
  key: string
  value: unknown
  created_at: string
  updated_at: string
}

/** API error returned by the server */
export interface NeuraApiError {
  code: string
  message: string
  action?: string
  retry_after?: number
  docs_url?: string
  x402?: X402Details
}

/** Generic API response wrapper */
export interface ApiResponse<T> {
  data: T
  meta?: {
    total?: number
    query?: string
    credits_remaining?: number
  }
}

/** Rate limit headers returned by the API */
export interface RateLimitInfo {
  limit: number
  remaining: number
  resetMs: number
}
