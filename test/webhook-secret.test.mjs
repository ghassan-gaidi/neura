import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routeSrc = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'api', 'webhooks', '[id]', 'route.ts'),
  'utf8'
)
const collectionSrc = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'api', 'webhooks', 'route.ts'),
  'utf8'
)

test('the webhook detail route does not select the secret column', () => {
  assert.doesNotMatch(routeSrc, /\.select\([^)]*secret/)
})

test('the webhook collection route does not select the secret column', () => {
  assert.doesNotMatch(collectionSrc, /\.select\([^)]*secret/)
})
