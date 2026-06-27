/**
 * Standard response helpers for consistent API responses.
 * Every response includes machine-readable error format, usage headers,
 * and CORS support.
 */
import { NextResponse } from 'next/server'

interface ResponseMeta {
  total?: number
  query?: string
  credits_remaining?: number
}

interface RateLimitInfo {
  limit: number
  remaining: number
  resetMs: number
}

function setRateLimitHeaders(headers: Headers, rl?: RateLimitInfo): void {
  if (rl) {
    headers.set('X-RateLimit-Limit', String(rl.limit))
    headers.set('X-RateLimit-Remaining', String(rl.remaining))
    headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
  }
}

/**
 * Send a successful JSON response with standard headers.
 */
export function respond(
  data: unknown,
  status = 200,
  meta?: ResponseMeta,
  rateLimit?: RateLimitInfo,
): NextResponse {
  const body = meta ? { data, meta } : { data }
  const response = NextResponse.json(body, { status })

  // Standard headers every agent can rely on
  if (meta?.credits_remaining !== undefined) {
    response.headers.set('X-Credits-Remaining', String(meta.credits_remaining))
  }

  setRateLimitHeaders(response.headers, rateLimit)

  return response
}

/**
 * Send an error response in the consistent format.
 */
export function respondError(
  code: string,
  message: string,
  status: number,
  extras?: {
    action?: string
    retry_after?: number
    docs_url?: string
  },
  rateLimit?: RateLimitInfo,
): NextResponse {
  const response = NextResponse.json(
    {
      error: {
        code,
        message,
        action: extras?.action || getDefaultAction(code),
        ...extras,
      },
    },
    { status }
  )

  if (extras?.retry_after) {
    response.headers.set('Retry-After', String(extras.retry_after))
  }

  setRateLimitHeaders(response.headers, rateLimit)

  return response
}

function getDefaultAction(code: string): string {
  const actions: Record<string, string> = {
    unauthorized: 'check_api_key',
    validation_error: 'fix_request_body',
    rate_limited: 'wait_and_retry',
    insufficient_credits: 'add_funds',
    payment_required: 'send_payment',
    internal_error: 'retry',
    not_found: 'check_resource_id',
    conflict: 'resolve_conflict',
    bad_request: 'fix_request_body',
    forbidden: 'check_permissions',
  }
  return actions[code] || 'contact_support'
}
