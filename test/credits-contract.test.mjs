import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'src', 'app', 'api', 'credits', 'route.ts'), 'utf8')

test('the top_up url points at the endpoint that exists', () => {
  assert.doesNotMatch(src, /'\/api\/credits\/top-up'/)
})

test('the pricing payload is derived from the pricing table', () => {
  assert.match(src, /PRICING/)
})

test('the top-up path does not overwrite total_purchased with the balance', () => {
  assert.doesNotMatch(src, /total_purchased:\s*currentBalance/)
})
