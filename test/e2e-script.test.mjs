import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const script = readFileSync(join(root, 'scripts', 'e2e-test.sh'), 'utf8')

test('the assertion helper compares exact values, not substrings', () => {
  // The old helper did `echo "$actual" | grep -q "$expected"`, so an expected
  // value of "true" never matched the exit code "0" and the expected value of
  // "200|201" matched anything containing "200".
  assert.match(script, /if \[ "\$actual" = "\$expected" \]; then/)
})

test('no assertion compares against a shell exit code', () => {
  const offenders = script.match(/test_result[^\n]*"\$?"/g) || []
  assert.deepEqual(offenders, [], `exit-code assertions remain: ${offenders.join(' | ')}`)
})

test('no assertion expects an alternation of status codes', () => {
  // With exact matching, "200|201" can never match "201".
  const offenders = script.match(/test_result[^\n]*"\\\||[0-9]\\\|[0-9]/g) || []
  assert.deepEqual(offenders, [], `alternation expectations remain: ${offenders.join(' | ')}`)
})

test('the script reads raw_key and credits from the data envelope', () => {
  assert.match(script, /get\('data',\{\}\)\.get\('raw_key',''\)/)
  assert.match(script, /get\('data',\{\}\)\.get\('credits',0\)/)
})

test('the script extracts ids and balances from the data envelope', () => {
  assert.match(script, /d\.get\('data',d\)\.get\('id',''\)/)
  assert.match(script, /d\.get\('data',d\)\.get\('balance','\?'\)/)
})

test('the script expects the state upsert to return 201', () => {
  assert.match(script, /test_result "POST \/api\/state \(upsert\) → 201" "201"/)
})

test('the share call uses the field name the route requires', () => {
  assert.match(script, /"target_tenant_id":/)
  assert.doesNotMatch(script, /"tenant_id":"00000000/)
})

test('the summarize call sends memory_ids, which the route requires', () => {
  assert.match(script, /memory_ids/)
})

test('the script deletes the test user and its tenant rows', () => {
  assert.match(script, /auth\/v1\/admin\/users\/\$USER_ID/)
  assert.match(script, /rest\/v1\/\$T\?tenant_id=eq\.\$TENANT_ID/)
})

test('the script verifies a webhook delivery was recorded', () => {
  assert.match(script, /webhook_deliveries/)
  // The status check greps the response for the delivered status.
  assert.match(script, /grep -q '"delivered"'/)
  // ...and it is scoped to the tenant, so it asserts on OUR delivery.
  assert.match(script, /tenant_id=eq\.\$TENANT_ID/)
})

test('the script asserts the rate limit headers are present', () => {
  assert.match(script, /x-ratelimit-limit:/)
  assert.match(script, /x-ratelimit-remaining:/)
})
