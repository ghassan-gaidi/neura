/**
 * In-memory sliding window rate limiter.
 * 
 * Limits requests per API key over a rolling time window.
 * Uses an in-memory Map — suitable for single-instance deployments.
 * 
 * For production, swap to Vercel KV / Upstash Redis for distributed counting.
 */

interface RateLimitEntry {
  timestamps: number[]
}

interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number
  /** Window duration in seconds */
  windowMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  limit: 100,       // 100 requests
  windowMs: 60_000, // per 60 seconds
}

// In-memory store
const store = new Map<string, RateLimitEntry>()

// Periodic cleanup every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < 120_000)
    if (entry.timestamps.length === 0) {
      store.delete(key)
    }
  }
}, 300_000)

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  limit: number
  resetMs: number
}

/**
 * Check rate limit for a given key (usually apiKeyId or IP).
 * Returns whether the request is allowed and usage stats.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): RateLimitResult {
  const now = Date.now()
  let entry = store.get(key)

  if (!entry) {
    entry = { timestamps: [] }
    store.set(key, entry)
  }

  // Prune expired timestamps
  entry.timestamps = entry.timestamps.filter((t) => now - t < config.windowMs)

  if (entry.timestamps.length >= config.limit) {
    const oldest = entry.timestamps[0]
    const resetMs = oldest + config.windowMs - now
    return {
      allowed: false,
      remaining: 0,
      limit: config.limit,
      resetMs: Math.max(resetMs, 0),
    }
  }

  // Record this request
  entry.timestamps.push(now)

  return {
    allowed: true,
    remaining: config.limit - entry.timestamps.length,
    limit: config.limit,
    resetMs: config.windowMs,
  }
}

/**
 * Higher-order function to wrap Next.js API handlers with rate limiting.
 */
import { NextResponse } from 'next/server'
import { AuthContext } from './types'

export function withRateLimit(
  handler: (req: Request, auth: AuthContext) => Promise<NextResponse>,
  config?: RateLimitConfig
) {
  return async (req: Request, auth: AuthContext): Promise<NextResponse> => {
    const result = checkRateLimit(auth.apiKeyId, config)

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: {
            code: 'rate_limited',
            message: 'Rate limit exceeded. Please wait and retry.',
            action: 'wait_and_retry',
            retry_after: Math.ceil(result.resetMs / 1000),
          },
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(result.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
            'Retry-After': String(Math.ceil(result.resetMs / 1000)),
          },
        }
      )
    }

    const response = await handler(req, auth)
    
    // Attach rate limit headers
    response.headers.set('X-RateLimit-Limit', String(result.limit))
    response.headers.set('X-RateLimit-Remaining', String(result.remaining))
    response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetMs / 1000)))

    return response
  }
}
