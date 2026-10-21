import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'summary.md'), 'utf8')

test('summary.md does not claim Vercel KV rate limiting', () => {
  assert.doesNotMatch(src, /Vercel KV/i)
})

test('summary.md does not claim the signup triggers were removed without saying where', () => {
  // The triggers ARE removed — but by migration 012, so the summary should
  // not describe them as an out-of-band change.
  assert.doesNotMatch(src, /Triggers removed/)
})

test('summary.md lists the real migration count', () => {
  assert.match(src, /12 migrations/)
})
