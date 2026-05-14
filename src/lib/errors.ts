import { ApiError } from './types'
import { NextResponse } from 'next/server'

/**
 * Standard error codes used across all endpoints.
 * Every error is machine-readable so agents can act on it.
 */
export const ErrorCodes = {
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  VALIDATION_ERROR: 'validation_error',
  RATE_LIMITED: 'rate_limited',
  INSUFFICIENT_CREDITS: 'insufficient_credits',
  PAYMENT_REQUIRED: 'payment_required',
  INTERNAL_ERROR: 'internal_error',
  CONFLICT: 'conflict',
  BAD_REQUEST: 'bad_request',
} as const

/**
 * Create a consistent API error response.
 */
export function apiError(
  code: string,
  message: string,
  status: number,
  extras?: Partial<ApiError['error']>
): NextResponse {
  const body: ApiError = {
    error: {
      code,
      message,
      action: extras?.action || getDefaultAction(code),
      ...extras,
    },
  }
  return NextResponse.json(body, { status })
}

/**
 * 400 — bad request / validation error
 */
export function badRequest(message: string, details?: Partial<ApiError['error']>) {
  return apiError(ErrorCodes.VALIDATION_ERROR, message, 400, details)
}

/**
 * 401 — missing or invalid API key
 */
export function unauthorized(message = 'Missing or invalid API key') {
  return apiError(ErrorCodes.UNAUTHORIZED, message, 401, {
    action: 'provide_valid_api_key',
    docs_url: 'https://neura.sh/docs/authentication',
  })
}

/**
 * 404 — resource not found
 */
export function notFound(resource = 'Resource') {
  return apiError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404)
}

/**
 * 429 — rate limited
 */
export function rateLimited(retryAfter: number) {
  return apiError(ErrorCodes.RATE_LIMITED, 'Rate limit exceeded', 429, {
    action: 'wait_and_retry',
    retry_after: retryAfter,
  })
}

/**
 * 402 — payment required (for x402 integration)
 */
export function paymentRequired(amountUsdc: string, destinationWallet: string) {
  return apiError(ErrorCodes.PAYMENT_REQUIRED, 'Insufficient credits', 402, {
    action: 'send_payment',
    retry_after: 30,
    docs_url: 'https://neura.sh/docs/payments',
  })
}

/**
 * 500 — unexpected error
 */
export function internalError(message = 'An unexpected error occurred') {
  return apiError(ErrorCodes.INTERNAL_ERROR, message, 500, {
    action: 'retry',
    retry_after: 1,
  })
}

/**
 * Parse a JSON request body safely.
 */
export async function parseBody<T>(request: Request): Promise<{ data?: T; error?: NextResponse }> {
  try {
    const data = await request.json()
    return { data: data as T }
  } catch {
    return { error: badRequest('Invalid JSON body') }
  }
}

/**
 * Default agent-facing actions for each error type.
 */
function getDefaultAction(code: string): string {
  const actions: Record<string, string> = {
    [ErrorCodes.UNAUTHORIZED]: 'check_api_key',
    [ErrorCodes.VALIDATION_ERROR]: 'fix_request_body',
    [ErrorCodes.RATE_LIMITED]: 'wait_and_retry',
    [ErrorCodes.INSUFFICIENT_CREDITS]: 'add_funds',
    [ErrorCodes.PAYMENT_REQUIRED]: 'send_payment',
    [ErrorCodes.INTERNAL_ERROR]: 'retry',
    [ErrorCodes.NOT_FOUND]: 'check_resource_id',
    [ErrorCodes.CONFLICT]: 'resolve_conflict',
  }
  return actions[code] || 'contact_support'
}
