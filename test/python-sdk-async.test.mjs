import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const src = readFileSync(join(root, 'sdk', 'python', 'neura', 'client.py'), 'utf8')

test('the Python SDK does not call asyncio.run unconditionally', () => {
  // The old code called asyncio.run() directly, which raises
  // "RuntimeError: asyncio.run() cannot be called from a running event loop"
  // when used from a notebook or an async framework.
  assert.doesNotMatch(src, /asyncio\.run\(handle_payment_required/)
})

test('the Python SDK detects a running event loop before auto-paying', () => {
  assert.match(src, /asyncio\.get_running_loop\(\)/)
})

test('the async-context failure surfaces a stable, actionable error', () => {
  assert.match(src, /async_context_unsupported/)
  assert.match(src, /handle_payment_manually/)
})

test('a NeuraHttpError raised by the guard is not swallowed by the payment handler', () => {
  // The payment block catches broad Exception; without this re-raise the
  // actionable error would be replaced by a generic "payment_failed".
  assert.match(src, /except NeuraHttpError:\s*(?:#[^\n]*\n\s*)*raise/)
})
