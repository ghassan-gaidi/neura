/**
 * Next.js Edge Middleware
 * Adds CORS headers to all API responses.
 */
import { NextRequest, NextResponse } from 'next/server'

const ALLOWED_ORIGINS = [
  'https://neura-blond.vercel.app',
  'https://ghassan.tech',
  'http://localhost:3000',
  'http://localhost:3001',
]

function getAllowedOrigin(origin: string | null): string {
  if (!origin) return ALLOWED_ORIGINS[0]
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  // For SDK/API calls from non-browser clients, allow any origin
  // but don't reflect arbitrary origins back
  return ALLOWED_ORIGINS[0]
}

export function middleware(request: NextRequest) {
  // Only handle API routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const origin = request.headers.get('origin')
  const allowedOrigin = getAllowedOrigin(origin)

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, Idempotency-Key, X-Idempotency-Key',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, Idempotency-Key, X-Idempotency-Key')

  // Request ID for tracing
  const requestId = crypto.randomUUID().slice(0, 8)
  response.headers.set('X-Request-Id', requestId)

  return response
}

export const config = {
  matcher: '/api/:path*',
}
