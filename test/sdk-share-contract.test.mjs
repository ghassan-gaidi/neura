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
  // Scope to the SHARE path first, then to its own post operation. The share
  // path also has get/delete operations which legitimately declare 200, so the
  // assertion must not cover the whole path block, and it must not accidentally
  // pick up the first `post:` in the file (which belongs to /api/memory).
  const sharePathIdx = yaml.indexOf('  /api/memory/{id}/share:')
  assert.notEqual(sharePathIdx, -1, 'spec must document the /api/memory/{id}/share path')
  // Bound the path block: it ends at the next 2-space-indented path key.
  const afterShare = yaml.slice(sharePathIdx)
  const nextPathIdx = afterShare.slice(1).search(/^ {2}\S/m)
  const shareBlock = nextPathIdx === -1 ? afterShare : afterShare.slice(0, nextPathIdx + 1)
  // The post operation starts at a 4-space-indented `post:` key...
  const postMatch = /^ {4}post:$/m.exec(shareBlock)
  assert.ok(postMatch, 'the share path must declare a post operation')
  const postStart = postMatch.index
  // ...and ends at the next 4-space-indented sibling operation
  // (get/put/patch/delete), so the slice cannot bleed into the get operation.
  const afterPost = shareBlock.slice(postStart)
  const nextOpIdx = afterPost.search(/^ {4}(get|put|patch|delete):$/m)
  const postBlock = nextOpIdx === -1 ? afterPost : afterPost.slice(0, nextOpIdx)
  assert.match(postBlock, /"201":/, 'share post must declare a 201 response')
  assert.doesNotMatch(postBlock, /"200":/, 'share post must not declare a 200 response')
})
