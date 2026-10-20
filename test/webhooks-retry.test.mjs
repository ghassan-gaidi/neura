import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'src', 'lib', 'webhooks.ts'),
  'utf8'
)

test('retryFailedDeliveries accepts an optional tenant filter', () => {
  assert.match(src, /export async function retryFailedDeliveries\(tenantId\?: string\)/)
})

test('the tenant filter is applied to the delivery query', () => {
  assert.match(src, /if \(tenantId\)\s*\{\s*dueQuery\s*=\s*dueQuery\.eq\('tenant_id',\s*tenantId\)/)
})
