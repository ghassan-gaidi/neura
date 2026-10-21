import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'AGENTS.md'), 'utf8')

test('AGENTS.md does not describe products that are not in this repo', () => {
  for (const wrong of ['Dominion', 'PICKR', 'crypto intelligence', 'Crypto Price API']) {
    assert.doesNotMatch(src, new RegExp(wrong, 'i'), `AGENTS.md still mentions ${wrong}`)
  }
})

test('AGENTS.md states the real SDK version and cron count', () => {
  assert.match(src, /neura-api\S*\s*0\.3\.0/)
  assert.match(src, /3\s+crons|three\s+crons/i)
})

test('AGENTS.md names the real embedding provider', () => {
  assert.match(src, /Voyage/i)
})
