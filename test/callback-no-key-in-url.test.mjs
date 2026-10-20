import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'auth', 'callback', 'page.tsx'),
  'utf8'
)

test('the callback never puts the API key in the redirect URL', () => {
  assert.doesNotMatch(src, /router\.push\([^)]*\?key=/)
  assert.doesNotMatch(src, /encodeURIComponent\(apiKey\)/)
})
