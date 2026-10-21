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
  const re = /\brespond(?:Error)?\s*\(/g
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
