import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('no user-facing file claims OpenAI embeddings', () => {
  const files = [
    'src/app/docs/page.tsx',
    'src/app/layout.tsx',
    'src/app/page.tsx',
    'src/components/seo/APIReferenceSchema.tsx',
  ]
  const offenders = files.filter(f => /openai/i.test(read(f)))
  assert.deepEqual(offenders, [])
})

test('the landing page states the real endpoint count', () => {
  const src = read('src/app/page.tsx')
  assert.doesNotMatch(src, /n:\s*'28'/)
  assert.match(src, /n:\s*'38'/)
  assert.match(src, /label:\s*'API Endpoints'/)
})

test('the docs page uses the correct PyPI package name', () => {
  const src = read('src/app/docs/page.tsx')
  assert.doesNotMatch(src, /pip install neura-api\b(?!-python)/)
  assert.match(src, /pip install neura-api-python/)
})
