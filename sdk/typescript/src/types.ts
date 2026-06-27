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
  /** Autonomous payment handling (x402). */
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
  onPaymentRequired?: (x402: X402Details) => Promise<string>
  privateKey?: string
  rpcUrl?: string
}

// ─── Memory ────────────────────────────────────────────────

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

/** Batch create result */
export interface BatchCreateResult {
  stored: number
  memories: Memory[]
}

/** Batch delete result */
export interface BatchDeleteResult {
  deleted: number
  ids: string[]
}

/** Summarize result */
export interface SummarizeResult {
  summary: string
  memory_count: number
}

// ─── State ─────────────────────────────────────────────────

/** A state entry */
export interface StateEntry {
  key: string
  value: unknown
  created_at: string
  updated_at: string
}

// ─── Webhooks ──────────────────────────────────────────────

export type WebhookEvent =
  | 'memory.created'
  | 'memory.updated'
  | 'memory.deleted'
  | 'memory.expiring'
  | 'state.changed'
  | 'memory.shared'
  | 'credits.low'

/** A registered webhook */
export interface Webhook {
  id: string
  url: string
  events: WebhookEvent[]
  is_active: boolean
  secret?: string | null
  created_at: string
  updated_at: string
}

/** Input for creating a webhook */
export interface CreateWebhookInput {
  url: string
  events: WebhookEvent[]
  secret?: string
}

// ─── Admin ─────────────────────────────────────────────────

/** An API key metadata */
export interface ApiKeyMeta {
  id: string
  label: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

/** API key creation result (includes raw key once) */
export interface ApiKeyCreateResult extends ApiKeyMeta {
  raw_key: string
}

/** A credit transaction */
export interface Transaction {
  id: string
  amount: number
  transaction_type: string
  description?: string
  created_at: string
}

/** Usage statistics */
export interface UsageStats {
  total_requests: number
  credits_used: number
  credits_purchased: number
  by_endpoint: Record<string, number>
  by_day: Record<string, number>
}

// ─── Credits ───────────────────────────────────────────────

/** Credit balance and pricing */
export interface CreditsBalance {
  balance: number
  pricing: Record<string, number>
  top_up: {
    via: {
      chain: string
      token: string
      recipient: string
      pricePerThousand: string
      minTopUp: number
    }
    url: string
  }
}

// ─── Core API types ────────────────────────────────────────

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
