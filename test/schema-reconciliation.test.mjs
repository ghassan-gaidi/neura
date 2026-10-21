import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('a migration enables RLS on every Neura table', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  const tables = [
    'api_keys', 'memories', 'state_store', 'usage_logs', 'webhooks',
    'webhook_deliveries', 'shared_memories', 'credit_balances',
    'credit_transactions', 'users',
  ]
  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
      `RLS not enabled for ${table}`
    )
  }
})

test('a migration adds the missing retry_count column', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  assert.match(sql, /ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0/)
})

test('a migration drops the crashing signup triggers', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  assert.match(sql, /DROP TRIGGER IF EXISTS on_auth_user_created ON auth\.users/)
  assert.match(sql, /DROP TRIGGER IF EXISTS on_user_created ON public\.users/)
})

test('a migration creates no permissive anon policy', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  assert.doesNotMatch(sql, /TO\s+anon/)
  assert.doesNotMatch(sql, /TO\s+authenticated/)
})
