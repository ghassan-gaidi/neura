import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('the TypeScript SDK sends target_tenant_id when sharing', () => {
  const src = readFileSync(join(root, 'sdk', 'typescript', 'src', 'memory.ts'), 'utf8')
  assert.match(src, /target_tenant_id/)
  assert.doesNotMatch(src, /\{\s*tenant_id:\s*tenantId/)
})

test('the Python SDK sends target_tenant_id when sharing', () => {
  const src = readFileSync(join(root, 'sdk', 'python', 'neura', 'memory.py'), 'utf8')
  assert.match(src, /target_tenant_id/)
})

test('the OpenAPI spec documents target_tenant_id as required for share', () => {
  const yaml = readFileSync(join(root, 'docs', 'openapi.yaml'), 'utf8')
  assert.match(yaml, /required:\s*\[target_tenant_id\]/)
})
