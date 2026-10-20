import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

function src(p) { return readFileSync(join(root, p), 'utf8') }

test('the memory create route enforces the free tier limit', () => {
  assert.match(src('src/app/api/memory/route.ts'), /checkMemoryLimit/)
  assert.match(src('src/app/api/memory/route.ts'), /free_tier_limit/)
})

test('the batch create route enforces the free tier limit', () => {
  assert.match(src('src/app/api/memory/batch/route.ts'), /checkMemoryLimit/)
})
