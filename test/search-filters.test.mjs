import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('a filtered search RPC exists', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '011_search_with_filters.sql'), 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION search_memories_filtered/)
  assert.match(sql, /p_tags/)
  assert.match(sql, /p_importance_min/)
  assert.match(sql, /p_date_from/)
})

test('the search route uses the filtered RPC', () => {
  const src = readFileSync(join(root, 'src', 'app', 'api', 'memory', 'search', 'route.ts'), 'utf8')
  assert.match(src, /search_memories_filtered/)
})

test('every SQL-side filter is applied before the LIMIT', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '011_search_with_filters.sql'), 'utf8')
  const body = sql.slice(sql.indexOf('RETURN QUERY'))
  const limitIdx = body.indexOf('LIMIT p_limit')
  assert.ok(limitIdx > -1, 'expected LIMIT clause')
  for (const cond of [
    'm.tags && p_tags',
    'm.importance >= p_importance_min',
    'm.importance <= p_importance_max',
    'm.created_at >= p_date_from',
    'm.created_at <= p_date_to',
  ]) {
    const idx = body.indexOf(cond)
    assert.ok(idx > -1, `missing filter: ${cond}`)
    assert.ok(idx < limitIdx, `filter must come before LIMIT: ${cond}`)
  }
  const orderByIdx = body.indexOf('ORDER BY')
  assert.ok(orderByIdx > -1 && orderByIdx < limitIdx, 'ORDER BY must precede LIMIT')
})

test('the filtered RPC uses extensions.vector(1024) and is idempotent', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '011_search_with_filters.sql'), 'utf8')
  assert.match(sql, /CREATE OR REPLACE FUNCTION search_memories_filtered/)
  assert.match(sql, /p_embedding extensions\.vector\(1024\)/)
})

test('the filtered RPC RETURNS TABLE matches current search_memories (007)', () => {
  const cur = readFileSync(join(root, 'supabase', 'migrations', '007_embeddings_dim_1024.sql'), 'utf8')
  const sql = readFileSync(join(root, 'supabase', 'migrations', '011_search_with_filters.sql'), 'utf8')
  const extract = (s) => {
    const m = s.match(/RETURNS TABLE\((\s*[\s\S]*?\s*)\)\s*LANGUAGE/)
    return m ? m[1].replace(/\s+/g, ' ').trim() : null
  }
  assert.equal(extract(sql), extract(cur))
})

test('the route passes all filters to the RPC and only metadata to applyFilters', () => {
  const src = readFileSync(join(root, 'src', 'app', 'api', 'memory', 'search', 'route.ts'), 'utf8')
  for (const p of ['p_tags', 'p_importance_min', 'p_importance_max', 'p_date_from', 'p_date_to']) {
    assert.match(src, new RegExp(p + ':'), `missing RPC param ${p}`)
  }
  assert.match(src, /applyFilters\(results, \{\s*metadata:\s*f\.metadata\s*\}\)/)
  assert.doesNotMatch(src, /applyFilters\(results,\s*body\.filters\)/)
  assert.match(src, /query\.contains\('metadata',\s*\{\s*\[key\]:\s*value\s*\}\)/)
})

test('the credit cost for advanced search is unchanged at 2', () => {
  const pricing = readFileSync(join(root, 'src/lib/pricing.ts'), 'utf8')
  assert.match(pricing, /'POST \/api\/memory\/search': 2/)
})
