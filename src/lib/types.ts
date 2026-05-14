// ============================================================
// Shared types for the Neura API
// ============================================================

/** Memory entry returned to agents */
export interface Memory {
  id: string
  content: string
  metadata: Record<string, unknown>
  tags: string[]
  importance: number
  score?: number
  expires_at?: string
  created_at: string
  updated_at: string
}

/** Key-value state entry */
export interface StateEntry {
  key: string
  value: unknown
  created_at: string
  updated_at: string
}

/** Consistent error response body */
export interface ApiError {
  error: {
    code: string
    message: string
    action?: string
    retry_after?: number
    docs_url?: string
  }
}

/** Successful response envelope */
export interface ApiSuccess<T = unknown> {
  data: T
  meta?: {
    total?: number
    query?: string
    credits_remaining?: number
  }
}

/** POST /api/memory request body */
export interface CreateMemoryRequest {
  content: string
  metadata?: Record<string, unknown>
  tags?: string[]
  importance?: number
  expires_at?: string
  embedding?: number[]
}

/** POST /api/memory/search request body */
export interface SearchMemoryRequest {
  query?: string
  embedding?: number[]
  filters?: {
    tags?: string[]
    importance_min?: number
    importance_max?: number
    metadata?: Record<string, unknown>
    date_from?: string
    date_to?: string
  }
  limit?: number
  min_score?: number
}

/** POST /api/state request body */
export interface UpsertStateRequest {
  key: string
  value: unknown
}

/** Auth context resolved from Bearer token */
export interface AuthContext {
  tenantId: string
  apiKeyId: string
}
