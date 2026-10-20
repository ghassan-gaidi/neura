import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const routePath = join(root, 'src', 'app', 'api', 'memory', 'summarize', 'route.ts')
const openApiPath = join(root, 'docs', 'openapi.yaml')
const sdkTypesPath = join(root, 'sdk', 'typescript', 'src', 'types.ts')

function extractRespondObject(src, fromIdx) {
  const start = src.indexOf('respond(', fromIdx)
  assert.ok(start !== -1, 'expected respond( call from index ' + fromIdx)
  const open = src.indexOf('{', start)
  assert.ok(open !== -1)
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return src.slice(open, i + 1)
    }
  }
  return null
}

test('the empty-memories branch returns all four summarize fields', () => {
  const src = readFileSync(routePath, 'utf8')
  const emptyIdx = src.indexOf('memories.length === 0')
  assert.ok(emptyIdx !== -1, 'route must contain an empty-memories branch')
  const obj = extractRespondObject(src, emptyIdx)
  assert.ok(obj, 'must find respond({...}) in the empty branch')
  assert.match(obj, /\bsummary\s*:/, 'missing "summary"')
  assert.match(obj, /\btotal_memories\s*:/, 'missing "total_memories"')
  assert.match(obj, /\bsummary_type\s*:/, 'missing "summary_type"')
  assert.match(obj, /\bmemory_ids\s*:/, 'missing "memory_ids"')
})

test('empty branch and populated branch use the same summary_type source', () => {
  const src = readFileSync(routePath, 'utf8')
  const emptyIdx = src.indexOf('memories.length === 0')
  const popRespondIdx = src.lastIndexOf('respond(')
  assert.ok(emptyIdx !== -1 && popRespondIdx !== -1)
  const emptyObj = extractRespondObject(src, emptyIdx)
  const popObj = extractRespondObject(src, popRespondIdx)
  assert.ok(emptyObj && popObj)
  const emptyTypeExpr = emptyObj.match(/summary_type\s*:\s*([^,}]+)/)?.[1]?.trim()
  const popTypeExpr = popObj.match(/summary_type\s*:\s*([^,}]+)/)?.[1]?.trim()
  assert.strictEqual(emptyTypeExpr, popTypeExpr,
    'empty and populated branches must report summary_type the same way; got "' + emptyTypeExpr + '" vs "' + popTypeExpr + '"')
})

test('summaryType is declared before it is used in the empty branch (no TDZ)', () => {
  const src = readFileSync(routePath, 'utf8')
  const decl = src.indexOf("const summaryType = body.type || 'extractive'")
  const empty = src.indexOf('memories.length === 0')
  assert.ok(decl !== -1 && empty !== -1)
  assert.ok(decl < empty, 'summaryType must be declared before the empty-memories branch (runtime TDZ guard)')
})

test('the empty branch returns before credit deduction (unchanged charging behaviour)', () => {
  const src = readFileSync(routePath, 'utf8')
  const emptyResponse = src.indexOf('return respond({ summary', src.indexOf('memories.length === 0'))
  const deduct = src.lastIndexOf('deductCredits')
  assert.ok(emptyResponse !== -1 && deduct !== -1)
  assert.ok(emptyResponse < deduct,
    'empty-memories branch must return before deductCredits (credit-deduction behaviour unchanged)')
})

test('OpenAPI summarize 200 response schema lists all four fields', () => {
  const yaml = readFileSync(openApiPath, 'utf8')
  // Scope to the /api/memory/summarize path block, then to the 200 response schema only.
  const pathStart = yaml.indexOf('  /api/memory/summarize:')
  assert.notStrictEqual(pathStart, -1, 'OpenAPI spec must contain /api/memory/summarize')
  const rest = yaml.slice(pathStart + 1)
  const nextPath = rest.search(/\n  \/\S/)
  const pathBlock = nextPath === -1 ? yaml.slice(pathStart) : yaml.slice(pathStart, pathStart + 1 + nextPath)
  const resp200 = pathBlock.indexOf('"200":')
  assert.notStrictEqual(resp200, -1, 'summarize must declare a 200 response')
  const respRest = pathBlock.slice(resp200 + 1)
  const nextResp = respRest.search(/\n {8}"\d{3}":/)
  const responseBlock = nextResp === -1 ? pathBlock.slice(resp200) : pathBlock.slice(resp200, resp200 + 1 + nextResp)
  assert.match(responseBlock, /summary:\s*\n\s+type:\s*string/, 'response schema missing summary')
  assert.match(responseBlock, /total_memories:\s*\n\s+type:\s*integer/, 'response schema missing total_memories')
  assert.match(responseBlock, /summary_type:\s*\n\s+type:\s*string/, 'response schema missing summary_type')
  assert.match(responseBlock, /memory_ids:\s*\n\s+type:\s*array/, 'response schema missing memory_ids')
})

test('SDK SummarizeResult declares all four fields with correct summary_type union', () => {
  const ts = readFileSync(sdkTypesPath, 'utf8')
  assert.match(ts, /summary_type\s*:\s*'extractive' \| 'abstractive'/)
  assert.match(ts, /memory_ids\s*:\s*string\[\]/)
  assert.match(ts, /total_memories\s*:\s*number/)
  assert.match(ts, /summary\s*:\s*string/)
})
