import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8')

test('the README does not claim Vercel KV rate limiting', () => {
  assert.doesNotMatch(src, /Vercel KV/i)
})

test('the README states the real batch pricing', () => {
  assert.match(src, /Batch create \(per memory\)\s*\|\s*1 credit/i)
})

test('the README uses the correct PyPI package name', () => {
  assert.match(src, /pip install neura-api-python/)
})

test('the README does not claim a stale endpoint count', () => {
  assert.doesNotMatch(src, /\b28 API Endpoints\b/)
  assert.doesNotMatch(src, /\(28 Endpoints\)/)
  assert.match(src, /38 API endpoints across 24 routes/)
})
