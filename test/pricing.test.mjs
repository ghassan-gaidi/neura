import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCreditCost, batchCost } from '../src/lib/pricing.ts'

test('batch is not priced by the shorter memory prefix', () => {
  assert.equal(getCreditCost('POST', '/api/memory/batch'), 1)
  assert.equal(getCreditCost('POST', '/api/memory'), 1)
})

test('search and summarize keep their premium prices', () => {
  assert.equal(getCreditCost('POST', '/api/memory/search'), 2)
  assert.equal(getCreditCost('POST', '/api/memory/summarize'), 5)
})

test('parameterized routes are priced by the most specific pattern', () => {
  // A concrete share path must match 'POST /api/memory/:id/share' (free),
  // not the shorter 'POST /api/memory' prefix (1 credit).
  assert.equal(getCreditCost('POST', '/api/memory/abc/share'), 0)
  assert.equal(getCreditCost('GET', '/api/memory/abc/share'), 0)
  assert.equal(getCreditCost('DELETE', '/api/memory/abc/share'), 0)
})

test('state and webhook operations are free', () => {
  assert.equal(getCreditCost('POST', '/api/state'), 0)
  assert.equal(getCreditCost('POST', '/api/webhooks'), 0)
})

test('a batch of N memories costs N credits', () => {
  assert.equal(batchCost(1), 1)
  assert.equal(batchCost(10), 10)
  assert.equal(batchCost(25), 25)
})
