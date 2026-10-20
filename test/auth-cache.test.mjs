import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'auth.ts'), 'utf8')

test('the auth cache is bounded', () => {
  assert.match(src, /AUTH_CACHE_MAX_ENTRIES/)
  assert.match(src, /authCache\.size\s*>=\s*AUTH_CACHE_MAX_ENTRIES/)
})
