/**
 * Quick smoke test of the Neura API against the live Supabase project.
 * Tests: auth, memory CRUD, state CRUD, search.
 */
const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

const SUPABASE_URL = 'https://hykistvnlfhiywuifcak.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5a2lzdHZubGZoaXl3dWlmY2FrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODc2ODc4MCwiZXhwIjoyMDk0MzQ0NzgwfQ.KjsPcwJrutJSYY8y1m-AT6Cx08oos7umKnxuiBG1t8s'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  let passed = 0
  let failed = 0

  function check(name, ok, detail) {
    if (ok) {
      console.log(`  ✓ ${name}`)
      passed++
    } else {
      console.log(`  ✗ ${name}: ${detail}`)
      failed++
    }
  }

  const TENANT_ID = '458c74fd-4f7d-43ce-bcf6-227970a305b9'
  const testKey = 'sk-test-neura-2026'
  const keyHash = crypto.createHash('sha256').update(testKey).digest('hex')

  // 1. Auth: verify API key lookup
  console.log('\nAuth:')
  const { data: keyData, error: keyErr } = await supabase
    .from('api_keys')
    .select('id, tenant_id, is_active')
    .eq('key_hash', keyHash)
    .single()

  check('API key lookup works', !keyErr && keyData?.is_active === true, keyErr?.message)

  // 2. Memory: create
  console.log('\nMemory:')
  const { data: mem1, error: mem1Err } = await supabase
    .from('memories')
    .insert({
      tenant_id: TENANT_ID,
      content: 'The user prefers dark mode in all applications',
      metadata: { source: 'conversation', category: 'preference' },
      tags: ['preference', 'ui'],
      importance: 8,
    })
    .select('id, content, tags')
    .single()

  check('Create memory', !mem1Err && mem1?.content.includes('dark mode'), mem1Err?.message)

  // 3. Memory: list (most recent)
  const { data: memories, error: memListErr } = await supabase
    .from('memories')
    .select('id, content, importance')
    .eq('tenant_id', TENANT_ID)
    .order('created_at', { ascending: false })
    .limit(5)

  check('List memories', !memListErr && memories.length >= 1, memListErr?.message)

  // 4. Memory: update
  const { error: memUpdErr } = await supabase
    .from('memories')
    .update({ importance: 9 })
    .eq('id', mem1.id)
    .eq('tenant_id', TENANT_ID)

  check('Update memory', !memUpdErr, memUpdErr?.message)

  // 5. Memory: delete
  const { error: memDelErr } = await supabase
    .from('memories')
    .delete()
    .eq('id', mem1.id)
    .eq('tenant_id', TENANT_ID)

  check('Delete memory', !memDelErr, memDelErr?.message)

  // 6. State: create
  console.log('\nState:')
  const { data: s1, error: s1Err } = await supabase
    .from('state_store')
    .upsert(
      { tenant_id: TENANT_ID, key: 'current_goal', value: { task: 'Build Neura API', priority: 'high' } },
      { onConflict: 'tenant_id, key', ignoreDuplicates: false }
    )
    .select('key, value')
    .single()

  check('Create state', !s1Err && s1?.key === 'current_goal', s1Err?.message)

  // 7. State: retrieve by key
  const { data: s2, error: s2Err } = await supabase
    .from('state_store')
    .select('key, value')
    .eq('tenant_id', TENANT_ID)
    .eq('key', 'current_goal')
    .single()

  check('Get state by key', !s2Err && s2?.value?.task === 'Build Neura API', s2Err?.message)

  // 8. State: list all
  const { data: states, error: s3Err } = await supabase
    .from('state_store')
    .select('key, value')
    .eq('tenant_id', TENANT_ID)

  check('List all state', !s3Err && states.length >= 1, s3Err?.message)

  // 9. State: delete
  const { error: s4Err } = await supabase
    .from('state_store')
    .delete()
    .eq('tenant_id', TENANT_ID)
    .eq('key', 'current_goal')

  check('Delete state', !s4Err, s4Err?.message)

  // 10. Search RPC: verify function exists
  console.log('\nSearch:')
  const { data: funcExists, error: funcErr } = await supabase.rpc('search_memories', {
    p_tenant_id: TENANT_ID,
    p_embedding: new Array(1536).fill(0.01),
    p_limit: 1,
    p_min_score: 0,
  })

  check('search_memories RPC exists', !funcErr, funcErr?.message)

  // Summary
  console.log(`\n${'='.repeat(40)}`)
  console.log(`Passed: ${passed} / ${passed + failed}`)
  if (failed > 0) {
    console.log(`Failed: ${failed}`)
    process.exit(1)
  } else {
    console.log('All smoke tests passed!')
  }
}

main().catch((err) => {
  console.error('Test suite error:', err)
  process.exit(1)
})
