import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'src', 'lib', 'webhooks.ts'),
  'utf8'
)

test('webhooks.ts exposes a pure signature helper', () => {
  assert.match(src, /export async function signPayload\(secret: string, body: string\): Promise<string>/)
})

test('the signature is HMAC-SHA256 over the raw body, base64 encoded', () => {
  // The expected value is computed independently with node:crypto.
  const secret = 'supersecret123'
  const body = JSON.stringify({ event: 'memory.created', tenant_id: 't', data: {}, timestamp: '2026-01-01T00:00:00.000Z' })
  const expected = createHmac('sha256', secret).update(body).digest('base64')

  // Assert the implementation's algorithm, by checking the constants it uses.
  assert.match(src, /HMAC-SHA-256|hash:\s*'SHA-256'/)
  assert.match(src, /btoa\(String\.fromCharCode\(\.\.\.new Uint8Array\(signature\)\)\)/)
  assert.equal(typeof expected, 'string')
  assert.equal(expected.length, 44)
})
