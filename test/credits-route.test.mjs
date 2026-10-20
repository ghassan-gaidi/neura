import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTestTopUpAllowed } from '../src/lib/pricing.ts'

test('test_top_up is disabled unless explicitly allowed', () => {
  assert.equal(isTestTopUpAllowed({}), false)
  assert.equal(isTestTopUpAllowed({ ALLOW_TEST_TOP_UP: '' }), false)
  assert.equal(isTestTopUpAllowed({ ALLOW_TEST_TOP_UP: 'false' }), false)
  assert.equal(isTestTopUpAllowed({ ALLOW_TEST_TOP_UP: 'true' }), true)
})
