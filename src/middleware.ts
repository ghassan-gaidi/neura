/**
 * Next.js Edge Middleware
 * Adds CORS headers to all API responses.
 */
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Only handle API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const origin = request.headers.get('origin') || '*'

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Idempotency-Key',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Idempotency-Key')

  // Request ID for tracing
  const requestId = crypto.randomUUID().slice(0, 8)
  response.headers.set('X-Request-Id', requestId)

  // Log request
  console.log(`[${requestId}] ${request.method} ${request.nextUrl.pathname}`)

  return response
}

export const config = {
  matcher: '/api/:path*',
}
