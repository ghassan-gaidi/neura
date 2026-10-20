import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const tsTypes = readFileSync(join(root, 'sdk', 'typescript', 'src', 'types.ts'), 'utf8')
const tsMemory = readFileSync(join(root, 'sdk', 'typescript', 'src', 'memory.ts'), 'utf8')
const pyMemory = readFileSync(join(root, 'sdk', 'python', 'neura', 'memory.py'), 'utf8')

test('SummarizeResult matches the route response shape', () => {
  assert.match(tsTypes, /total_memories/)
  assert.match(tsTypes, /memory_ids/)
  assert.doesNotMatch(tsTypes, /SummarizeResult[\s\S]{0,120}memory_count/)
})

test('the TypeScript SDK sends memory_ids when no query is given', () => {
  assert.match(tsMemory, /memory_ids/)
})

test('the Python SDK sends memory_ids when no query is given', () => {
  assert.match(pyMemory, /memory_ids/)
})
