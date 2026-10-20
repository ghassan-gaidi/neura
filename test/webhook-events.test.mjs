import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('state.changed is emitted on state writes', () => {
  assert.match(read('src/app/api/state/route.ts'), /fireWebhook\([^)]*'state\.changed'/)
  assert.match(read('src/app/api/state/[key]/route.ts'), /fireWebhook\([^)]*'state\.changed'/)
})

test('credits.low is emitted when the balance drops low', () => {
  assert.match(read('src/lib/credits.ts'), /CREDITS_LOW_THRESHOLD/)
  assert.match(read('src/app/api/memory/route.ts'), /credits\.low/)
})

test('memory.expiring is emitted by the cleanup cron', () => {
  assert.match(read('src/app/api/memory/cleanup/route.ts'), /memory\.expiring/)
})
