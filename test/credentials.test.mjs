import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const REPO = join(import.meta.dirname, '..')

test('no tracked file contains a hardcoded Supabase service_role or anon key', () => {
  const files = execFileSync('git', ['ls-files'], { cwd: REPO, encoding: 'utf8' })
    .split('\n').filter(Boolean)
  const offenders = []
  for (const file of files) {
    const text = readFileSync(join(REPO, file), 'utf8')
    // A service_role JWT and an anon JWT both begin with this base64 header.
    if (/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{40,}/.test(text)) {
      offenders.push(file)
    }
  }
  assert.deepEqual(offenders, [], `hardcoded Supabase JWTs found in: ${offenders.join(', ')}`)
})
