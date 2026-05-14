// ============================================================
// Neura SDK — HTTP Client
// ============================================================

import type { ApiResponse, NeuraApiError, NeuraOptions, RateLimitInfo } from './types'

export class NeuraHttpError extends Error {
  public code: string
  public status: number
  public action?: string
  public retryAfter?: number
  public rateLimit?: RateLimitInfo

  constructor(status: number, error: NeuraApiError, rateLimit?: RateLimitInfo) {
    super(error.message)
    this.name = 'NeuraHttpError'
    this.code = error.code
    this.status = status
    this.action = error.action
    this.retryAfter = error.retry_after
    this.rateLimit = rateLimit
  }
}

/**
 * Low-level HTTP client with retry support.
 * Handles auth headers, JSON parsing, and error formatting.
 */
export class HttpClient {
  private baseUrl: string
  private apiKey: string
  private maxRetries: number

  constructor(options: NeuraOptions) {
    this.baseUrl = (options.baseUrl || 'https://neura.sh').replace(/\/+$/, '')
    this.apiKey = options.apiKey
    this.maxRetries = options.maxRetries ?? 3
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: { idempotencyKey?: string }
  ): Promise<{ data: T; meta?: Record<string, unknown>; rateLimit?: RateLimitInfo }> {
    const url = `${this.baseUrl}${path}`
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }

    if (options?.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey
    }

    let lastError: NeuraHttpError | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        })

        // Parse rate limit info from headers
        const rateLimit: RateLimitInfo | undefined = res.headers.has('X-RateLimit-Limit')
          ? {
              limit: parseInt(res.headers.get('X-RateLimit-Limit')!, 10),
              remaining: parseInt(res.headers.get('X-RateLimit-Remaining')!, 10),
              resetMs: parseInt(res.headers.get('X-RateLimit-Reset') || '60', 10) * 1000,
            }
          : undefined

        if (!res.ok) {
          const errorBody = await res.json().catch(() => ({
            error: { code: 'unknown', message: res.statusText },
          }))
          const error = errorBody.error || { code: 'unknown', message: 'Unknown error' }

          if (res.status === 429 && attempt < this.maxRetries) {
            // Rate limited — wait and retry
            const retryAfter = error.retry_after || Math.pow(2, attempt)
            await sleep(retryAfter * 1000)
            continue
          }

          if (res.status === 402) {
            // Payment required — throw immediately, not retryable
            throw new NeuraHttpError(res.status, error, rateLimit)
          }

          throw new NeuraHttpError(res.status, error, rateLimit)
        }

        const json: ApiResponse<T> = await res.json()
        return {
          data: json.data,
          meta: json.meta as Record<string, unknown> | undefined,
          rateLimit,
        }
      } catch (err) {
        if (err instanceof NeuraHttpError) throw err
        lastError = new NeuraHttpError(0, {
          code: 'network_error',
          message: `Request failed: ${(err as Error).message}`,
          action: 'retry',
        })

        if (attempt < this.maxRetries) {
          await sleep(Math.pow(2, attempt) * 500)
        }
      }
    }

    throw lastError || new NeuraHttpError(0, {
      code: 'max_retries',
      message: 'Max retries exceeded',
      action: 'check_network',
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
