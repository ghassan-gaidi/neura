import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const WRITE_ROUTES = [
  'src/app/api/memory/route.ts',
  'src/app/api/memory/batch/route.ts',
  'src/app/api/memory/[id]/route.ts',
  'src/app/api/memory/[id]/share/route.ts',
  'src/app/api/state/route.ts',
  'src/app/api/state/[key]/route.ts',
]

test('every write route wraps its handler in withIdempotency', () => {
  const offenders = WRITE_ROUTES.filter(p => !read(p).includes('withIdempotency'))
  assert.deepEqual(offenders, [])
})

test('every write route actually applies the idempotency wrapper', () => {
  // An import alone is not enough — the handler must be wrapped and
  // invoked with the request so a replay hits the cached response.
  const offenders = WRITE_ROUTES.filter(
    p => !(read(p).includes('withIdempotency(') && read(p).includes('})(request, auth)'))
  )
  assert.deepEqual(offenders, [])
})
