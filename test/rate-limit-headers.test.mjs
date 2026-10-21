import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(import.meta.dirname, '..')
const apiDir = join(repoRoot, 'src', 'app', 'api')

/**
 * Handlers that deliberately have no rate limit at all — no checkRateLimit( call,
 * no respond/respondError with an rl argument.
 *
 * Exemption rationale (deliberate, not an oversight):
 *   - src/app/api/migrate/route.ts GET: returns a static `{ message: 'Neura migrate' }`
 *     help string. No auth, no API key, nothing to key the limiter on, so rate
 *     limiting is meaningless here. The POST handler on the same file IS rate-limited
 *     (keyed by IP), and both handlers keep their gate checks (x-migration-key on POST).
 */
const NO_RATE_LIMIT_HANDLERS = new Set([
  'src/app/api/migrate/route.ts:GET',
])

function routeFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) routeFiles(full, out)
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

/**
 * Find every respond( or respondError( call in `src` at or after position `from`.
 * Uses a balanced-paren scan that respects string literals (single, double,
 * backtick) and nested brackets (parens, square brackets, braces), so calls
 * like respond(data, 201, getUsageMeta(auth, newBalance ?? undefined), rl)
 * are captured in full — unlike a naive /respond\([^)]*\)/ regex which stops
 * at the first ")" and would hide the trailing rl argument.
 *
 * Returns { text, idx } for each call where text is the full call text including
 * its closing paren.
 */
function findCalls(src, from = 0) {
  const out = []
  const re = /\brespond(?:Error|PaymentRequired)?\s*\(/g
  re.lastIndex = from
  let m
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length
    let depth = 1
    let inStr = null
    while (i < src.length && depth > 0) {
      const c = src[i]
      if (inStr) {
        if (c === '\\') { i += 2; continue }
        if (c === inStr) inStr = null
      } else if (c === "'" || c === '"' || c === '`') {
        inStr = c
      } else if (c === '(' || c === '[' || c === '{') {
        depth++
      } else if (c === ')' || c === ']' || c === '}') {
        depth--
      }
      i++
    }
    out.push({ text: src.slice(m.index, i), idx: m.index })
  }
  return out
}

test('every API route that rate-limits passes rl to respond/respondError', () => {
  const offenders = []

  for (const file of routeFiles(apiDir)) {
    const src = readFileSync(file, 'utf8')
    const rel = file.replace(repoRoot + '/', '').split('\\').join('/')

    // Split the file into per-handler blocks delimited by
    // export async function GET|POST|PATCH|DELETE|PUT
    const handlerRe = /export async function (GET|POST|PATCH|DELETE|PUT)\b/g
    const bounds = []
    let m
    while ((m = handlerRe.exec(src))) bounds.push({ name: m[1], start: m.index })
    bounds.push({ name: 'END', start: src.length })

    for (let i = 0; i < bounds.length - 1; i++) {
      const block = src.slice(bounds[i].start, bounds[i + 1].start)
      const handlerKey = `${rel}:${bounds[i].name}`

      // Find THIS handler's own checkRateLimit( occurrence (not the file's first).
      const rlIdx = block.indexOf('checkRateLimit(')
      if (rlIdx === -1) {
        // Handler has no rate limit at all — only allowed for explicitly-exempt handlers.
        if (!NO_RATE_LIMIT_HANDLERS.has(handlerKey)) {
          offenders.push(`${handlerKey}: no checkRateLimit() call in handler`)
        }
        continue
      }

      // Every respond()/respondError() AFTER this handler's checkRateLimit( call.
      for (const c of findCalls(block, rlIdx)) {
        const line = src.slice(0, bounds[i].start + c.idx).split('\n').length
        if (!/\brl\b/.test(c.text)) {
          offenders.push(`${handlerKey}:${line} ${c.text.replace(/\s+/g, ' ').slice(0, 140)}`)
        }
      }
    }
  }

  assert.deepEqual(offenders, [])
})

/**
 * D14a — the 6 "insufficient credits" x402 responses (the 402 an agent sees when
 * it needs to PAY) must carry the same X-RateLimit-* headers as every other
 * response. Before the fix they were built with a bare `NextResponse.json(...)`,
 * so a client polling for a top-up to clear saw a headerless 402.
 *
 * The check is intentionally structural rather than line-based:
 *   1. No route may build an x402 body with a raw `NextResponse.json`.
 *   2. Every route that mentions `buildX402Response` must route it through
 *      `respondPaymentRequired(x402, rl, ...)` — i.e. it passes `rl`, which is
 *      what makes the helper attach the rate-limit headers.
 *   3. The helper itself must set all three headers, keep the body exactly
 *      `{ error: x402 }`, and use status 402.
 */
test('D14a: every x402 402 response carries X-RateLimit-* headers', () => {
  const offenders = []

  // --- 1 + 2: route-level ------------------------------------------------------
  for (const file of routeFiles(apiDir)) {
    const src = readFileSync(file, 'utf8')
    const rel = file.replace(repoRoot + '/', '').split('\\').join('/')

    // A raw NextResponse.json building the x402 body bypasses the helper.
    if (/NextResponse\.json\(\s*\{\s*error:\s*x402\s*\}/.test(src)) {
      offenders.push(`${rel}: raw NextResponse.json({ error: x402 }) bypasses respondPaymentRequired`)
    }

    // Every x402 body must be returned through the helper, and the helper call
    // must pass `rl` so the rate-limit headers can be attached.
    if (src.includes('buildX402Response')) {
      const calls = findCalls(src, src.indexOf('buildX402Response'))
      const helperCalls = calls.filter((c) => c.text.startsWith('respondPaymentRequired('))
      if (helperCalls.length === 0) {
        offenders.push(`${rel}: buildX402Response() result is never returned via respondPaymentRequired()`)
      }
      for (const c of helperCalls) {
        if (!/\brl\b/.test(c.text)) {
          const line = src.slice(0, c.idx).split('\n').length
          offenders.push(`${rel}:${line} respondPaymentRequired(...) does not pass rl — no rate-limit headers`)
        }
      }
    }
  }

  // --- 3: helper contract -----------------------------------------------------
  const helper = readFileSync(join(repoRoot, 'src', 'lib', 'response.ts'), 'utf8')
  const helperBody = helper.slice(helper.indexOf('export function respondPaymentRequired'))
  // Check the shared setRateLimitHeaders function (used by respond/respondError
  // and by respondPaymentRequired) sets all three headers.
  const setHeadersMatch = helper.match(/function setRateLimitHeaders[\s\S]*?^\}/m)
  const setHeadersBody = setHeadersMatch ? setHeadersMatch[0] : ''
  for (const header of ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']) {
    if (!setHeadersBody.includes(header)) {
      offenders.push(`src/lib/response.ts: setRateLimitHeaders does not set ${header}`)
    }
  }
  if (!helperBody.includes('setRateLimitHeaders(response.headers, rl)')) {
    offenders.push('src/lib/response.ts: respondPaymentRequired does not call setRateLimitHeaders(response.headers, rl)')
  }
  if (!/status:\s*402/.test(helperBody)) {
    offenders.push('src/lib/response.ts: respondPaymentRequired does not use status 402')
  }
  if (!/NextResponse\.json\(\{\s*error:\s*x402\s*\}/.test(helperBody)) {
    offenders.push('src/lib/response.ts: respondPaymentRequired body is not exactly { error: x402 }')
  }

  assert.deepEqual(offenders, [])
})

/**
 * The two cron SUCCESS responses (the ones the reviewer flagged) must also
 * carry the three headers. They build the response inline, so assert on the
 * header-setting that follows each `NextResponse.json` in those two files.
 */
test('D14a: cron success responses carry X-RateLimit-* headers', () => {
  const offenders = []
  const cronFiles = [
    'src/app/api/memory/cleanup/route.ts',
    'src/app/api/webhooks/retry-cron/route.ts',
  ]
  for (const rel of cronFiles) {
    const src = readFileSync(join(repoRoot, rel), 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].includes('NextResponse.json') || !lines[i].includes('ok: true')) continue
      // Look at the response construction plus the 4 lines that follow it.
      const snippet = lines.slice(i, i + 5).join('\n')
      for (const header of ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset']) {
        if (!snippet.includes(header)) {
          offenders.push(`${rel}:${i + 1} success response missing ${header}`)
        }
      }
    }
  }
  assert.deepEqual(offenders, [])
})
