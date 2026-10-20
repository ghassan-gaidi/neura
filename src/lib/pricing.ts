/**
 * Credit pricing table.
 * Keys are "<METHOD> <pathname>" patterns. Exact matches win; otherwise the
 * longest matching prefix wins, so 'POST /api/memory/batch' is not captured
 * by 'POST /api/memory'.
 */
export const PRICING: Record<string, number> = {
  'POST /api/memory': 1,
  'GET /api/memory': 1,
  'POST /api/memory/batch': 1,      // per memory; batch route multiplies by count
  'POST /api/memory/search': 2,
  'PATCH /api/memory': 1,
  'DELETE /api/memory': 0,
  'POST /api/memory/summarize': 5,
  'POST /api/state': 0,
  'GET /api/state': 0,
  'DELETE /api/state': 0,
  'POST /api/webhooks': 0,
  'GET /api/webhooks': 0,
  'PATCH /api/webhooks': 0,
  'DELETE /api/webhooks': 0,
  'POST /api/memory/:id/share': 0,
  'GET /api/memory/:id/share': 0,
  'DELETE /api/memory/:id/share': 0,
  'GET /api/shared-with-me': 0,
  'POST /api/admin/keys': 0,
  'GET /api/admin/keys': 0,
}

/**
 * Whether the `test_top_up` free-credit shortcut is permitted.
 * Off unless ALLOW_TEST_TOP_UP is explicitly "true", so a production
 * deployment can never mint credits from a request body.
 */
export function isTestTopUpAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ALLOW_TEST_TOP_UP === 'true'
}

/**
 * Resolve the credit cost of a request.
 * Exact key match first, then the longest prefix match.
 * Returns 0 for unknown free operations, 1 as the default for unknown paid ones.
 */
export function getCreditCost(method: string, pathname: string): number {
  const key = `${method} ${pathname}`
  if (PRICING[key] !== undefined) return PRICING[key]

  let best: { pattern: string; cost: number } | null = null
  for (const [pattern, cost] of Object.entries(PRICING)) {
    const prefix = pattern.split(':')[0]
    if (!key.startsWith(prefix)) continue
    if (!best || prefix.length > best.pattern.length) best = { pattern: prefix, cost }
  }
  return best ? best.cost : 1
}
