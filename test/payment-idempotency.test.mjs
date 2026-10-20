import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('a migration adds a partial unique index on purchase reference_id', () => {
  const files = readFileSync(join(root, 'supabase', 'migrations', '010_payment_idempotency.sql'), 'utf8')
  assert.match(files, /CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_purchase_reference/)
  assert.match(files, /WHERE transaction_type\s*=\s*'purchase'/)
})
