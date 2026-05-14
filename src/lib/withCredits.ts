/**
 * Credit middleware for API routes.
 * Wraps a handler to check and deduct credits automatically.
 */

import { NextResponse } from 'next/server'
import { AuthContext } from './types'
import { checkCredits, deductCredits, buildX402Response } from './credits'

/**
 * Wrap an API handler with automatic credit checking and deduction.
 * 
 * - Checks balance before handler runs
 * - Deducts credits after successful handler response (status < 400)
 * - Returns 402 with x402 details if insufficient
 * - Adds X-Credits-Balance header to responses
 */
export function withCredits(
  handler: (req: Request, auth: AuthContext) => Promise<NextResponse>,
  method: string,
  pathname: string
) {
  return async (req: Request, auth: AuthContext): Promise<NextResponse> => {
    // Check credits before processing
    const creditCheck = await checkCredits(auth.tenantId, method, pathname)

    if (!creditCheck.allowed) {
      const x402 = buildX402Response(auth.tenantId, creditCheck.cost)
      return NextResponse.json(
        { error: x402 },
        {
          status: 402,
          headers: {
            'X-Credits-Balance': '0',
            'X-Credits-Needed': String(creditCheck.cost),
          },
        }
      )
    }

    // Process the request
    const response = await handler(req, auth)

    // Deduct credits on success (2xx or 3xx)
    if (response.status < 400) {
      const newBalance = await deductCredits(
        auth.tenantId,
        method,
        pathname,
        // Extract reference ID from response if available
        response.headers.get('X-Resource-Id') || undefined
      )

      if (newBalance !== null) {
        response.headers.set('X-Credits-Balance', String(newBalance))
      }
    } else {
      // Even on error, report balance
      response.headers.set('X-Credits-Balance', String(creditCheck.balance))
    }

    return response
  }
}
