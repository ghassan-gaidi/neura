/**
 * Idempotency support for write endpoints.
 * 
 * When a client sends an Idempotency-Key header, the server checks
 * if the key was already processed. If so, it returns the cached response
 * instead of re-processing the request.
 * 
 * In-memory store with TTL — swap to Supabase/Redis for durability.
 */

interface IdempotencyEntry {
  response: unknown
  status: number
  createdAt: number
}

const idempotencyStore = new Map<string, IdempotencyEntry>()
const IDEMPOTENCY_TTL_MS = 86_400_000 // 24 hours

// Periodic cleanup
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of idempotencyStore.entries()) {
    if (now - entry.createdAt > IDEMPOTENCY_TTL_MS) {
      idempotencyStore.delete(key)
    }
  }
}, 3600_000)

/**
 * Check if a request has already been processed.
 * Returns cached response if found, null otherwise.
 */
export function getIdempotentResponse(key: string): { data: unknown; status: number } | null {
  const entry = idempotencyStore.get(key)
  if (!entry) return null
  if (Date.now() - entry.createdAt > IDEMPOTENCY_TTL_MS) {
    idempotencyStore.delete(key)
    return null
  }
  return { data: entry.response, status: entry.status }
}

/**
 * Store a processed idempotency key with its response.
 */
export function setIdempotentResponse(
  key: string,
  response: unknown,
  status: number
): void {
  idempotencyStore.set(key, {
    response,
    status,
    createdAt: Date.now(),
  })
}

/**
 * Extract idempotency key from request headers.
 */
export function getIdempotencyKey(request: Request): string | null {
  return request.headers.get('Idempotency-Key') || 
         request.headers.get('idempotency-key') || 
         request.headers.get('X-Idempotency-Key') || 
         null
}

import { NextResponse } from 'next/server'
import { AuthContext } from './types'
import { logUsage } from './usage'

/**
 * Wraps a POST handler with idempotency support.
 * Only applies when the request has an Idempotency-Key header.
 */
export function withIdempotency<T extends Request = Request>(
  handler: (req: T, auth: AuthContext) => Promise<NextResponse>
) {
  return async (req: T, auth: AuthContext): Promise<NextResponse> => {
    const idempotencyKey = getIdempotencyKey(req)

    if (idempotencyKey) {
      // Scoped to tenant so one agent can't replay another's request
      const scopedKey = `${auth.tenantId}:${idempotencyKey}`
      const cached = getIdempotentResponse(scopedKey)
      if (cached) {
        logUsage(auth, 'idempotency_cache_hit')
        return new NextResponse(JSON.stringify(cached.data), {
          status: cached.status,
          headers: { 'Content-Type': 'application/json', 'X-Idempotency-Replayed': 'true' },
        })
      }
    }

    const response = await handler(req, auth)

    // Cache successful responses
    if (idempotencyKey && response.status < 500) {
      const scopedKey = `${auth.tenantId}:${idempotencyKey}`
      const body = await response.clone().json()
      setIdempotentResponse(scopedKey, body, response.status)
    }

    return response
  }
}
