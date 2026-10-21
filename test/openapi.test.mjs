import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'docs', 'openapi.yaml'), 'utf8')

test('the spec version matches the SDK version', () => {
  assert.match(src, /version:\s*["']?0\.3\.0/)
})

test('the spec covers every route file', () => {
  const required = [
    '/api/memory:', '/api/memory/batch:', '/api/memory/search:',
    '/api/memory/summarize:', '/api/memory/{id}:', '/api/memory/{id}/share:',
    '/api/memory/cleanup:', '/api/shared-with-me:', '/api/state:',
    '/api/state/{key}:', '/api/webhooks:', '/api/webhooks/{id}:',
    '/api/webhooks/retry:', '/api/webhooks/retry-cron:', '/api/credits:',
    '/api/payments/verify:', '/api/payments/poll:', '/api/auth/me:',
    '/api/auth/create-key:', '/api/admin/keys:', '/api/admin/keys/{id}:',
    '/api/admin/transactions:', '/api/admin/usage:', '/api/migrate:',
  ]
  const missing = required.filter(p => !src.includes(p))
  assert.deepEqual(missing, [])
})

test('the spec does not claim OpenAI embeddings', () => {
  assert.doesNotMatch(src, /via OpenAI/i)
  assert.doesNotMatch(src, /openai/i)
})

test('the spec uses the real payment verification field', () => {
  assert.match(src, /payment_tx/)
  assert.doesNotMatch(src, /transaction_hash/)
})

// --- Enumerate the real handlers from source and check the spec covers each ---

const ROOT = join(import.meta.dirname, '..')

function routeFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...routeFiles(full))
    else if (entry.name === 'route.ts') out.push(full)
  }
  return out
}

const handlers = []
for (const file of routeFiles(join(ROOT, 'src', 'app', 'api'))) {
  const content = readFileSync(file, 'utf8')
  const rel = file.slice(join(ROOT, 'src', 'app', 'api').length + 1).replace(/\/route\.ts$/, '')
  const specPath = `/api/${rel.replace(/\/\[id\]/g, '/{id}').replace(/\/\[key\]/g, '/{key}')}`
  for (const m of content.matchAll(/export async function\s+(GET|POST|PATCH|PUT|DELETE)\b/g)) {
    handlers.push({ method: m[1].toLowerCase(), specPath })
  }
}

// Extract the YAML block for a given path so method checks are scoped to it.
function pathBlock(specPath) {
  const lines = src.split('\n')
  const start = lines.findIndex(l => l === `  ${specPath}:`)
  if (start === -1) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^ {2}\S/.test(lines[i]) && !lines[i].trim().startsWith('#')) { end = i; break }
  }
  return lines.slice(start, end).join('\n')
}

test('the source exports 24 route files and 38 HTTP handlers', () => {
  const files = routeFiles(join(ROOT, 'src', 'app', 'api'))
  assert.equal(files.length, 24)
  assert.equal(handlers.length, 38)
})

test('the spec documents every route file and every HTTP handler', () => {
  const missing = []
  for (const h of handlers) {
    const block = pathBlock(h.specPath)
    if (block === null) { missing.push(`path ${h.specPath}`); continue }
    if (!new RegExp(`^ {4}${h.method}:$`, 'm').test(block)) {
      missing.push(`${h.method.toUpperCase()} ${h.specPath}`)
    }
  }
  assert.deepEqual(missing, [], `undocumented handlers: ${missing.join(', ')}`)
})
