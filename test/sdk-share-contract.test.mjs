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

test('the OpenAPI share endpoint declares 201 and not 200', () => {
  const yaml = readFileSync(join(root, 'docs', 'openapi.yaml'), 'utf8')
  // Scope to the /api/memory/{id}/share path block
  const pathStart = yaml.indexOf('  /api/memory/{id}/share:')
  assert.notStrictEqual(pathStart, -1, 'OpenAPI spec must contain /api/memory/{id}/share')
  const rest = yaml.slice(pathStart + 1)
  const nextPath = rest.search(/\n  \/\S/)
  const pathBlock = nextPath === -1 ? yaml.slice(pathStart) : yaml.slice(pathStart, pathStart + 1 + nextPath)
  // The route responds with 201 (respond(data, 201)); a 200 would be wrong.
  assert.match(pathBlock, /"201":/, 'share must declare a 201 response')
  assert.doesNotMatch(pathBlock, /"200":/, 'share must not declare a 200 response')
})
