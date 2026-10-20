import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

const DEDUCT_FILES = [
  'src/app/api/memory/route.ts',
  'src/app/api/memory/[id]/route.ts',
  'src/app/api/memory/summarize/route.ts',
  'src/app/api/memory/batch/route.ts',
  'src/app/api/memory/search/route.ts',
]

test('every deduction site fires credits.low (source scan)', () => {
  let deductCount = 0
  let fireCount = 0
  for (const p of DEDUCT_FILES) {
    const text = read(p)
    const d = (text.match(/deductCredits\(/g) || []).length
    const f = (text.match(/fireCreditsLowIfLow\(/g) || []).length
    deductCount += d
    fireCount += f
    assert.strictEqual(f, d, `${p}: ${d} deduction(s) need ${d} fireCreditsLowIfLow call(s), got ${f}`)
  }
  assert.strictEqual(deductCount, 7, `expected 7 deduction sites, got ${deductCount}`)
  assert.strictEqual(fireCount, 7, `expected 7 fireCreditsLowIfLow calls, got ${fireCount}`)
})
