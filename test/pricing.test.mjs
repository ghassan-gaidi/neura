import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCreditCost } from '../src/lib/pricing.ts'

test('batch is not priced by the shorter memory prefix', () => {
  assert.equal(getCreditCost('POST', '/api/memory/batch'), 1)
  assert.equal(getCreditCost('POST', '/api/memory'), 1)
})

test('search and summarize keep their premium prices', () => {
  assert.equal(getCreditCost('POST', '/api/memory/search'), 2)
  assert.equal(getCreditCost('POST', '/api/memory/summarize'), 5)
})

test('state and webhook operations are free', () => {
  assert.equal(getCreditCost('POST', '/api/state'), 0)
  assert.equal(getCreditCost('POST', '/api/webhooks'), 0)
})
