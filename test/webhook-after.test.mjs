import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const src = readFileSync(join(root, 'src', 'lib', 'webhooks.ts'), 'utf8')

test('webhook delivery is scheduled with after(), not a bare promise', () => {
  // A bare fire-and-forget promise is unsafe on Vercel: the function is
  // frozen once the response is sent, silently dropping the delivery and
  // its webhook_deliveries log row.
  assert.match(src, /import \{ after \} from 'next\/server'/)
  assert.match(src, /after\(deliver\)/)
})

test('fireWebhook falls back to inline delivery outside a request scope', () => {
  // `after()` throws when called outside a request scope; the catch must
  // still deliver rather than drop the event.
  assert.match(src, /catch \{[\s\S]{0,200}?void deliver\(\)/)
})

test('the delivery logic itself is unchanged and still awaited internally', () => {
  assert.match(src, /export async function deliverWebhookEvent/)
  assert.match(src, /await Promise\.allSettled\(/)
})
