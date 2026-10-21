#!/bin/bash
# Full E2E test against live Neura production API
# Tests: auth, memory CRUD, state, credits, search, webhooks, sharing

BASE="https://neura-blond.vercel.app"
PASS=0
FAIL=0
SKIP=0
RESULTS=""

test_result() {
  local name="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    PASS=$((PASS+1))
    RESULTS+="  ✓ $name\n"
  else
    FAIL=$((FAIL+1))
    RESULTS+="  ✗ $name (expected: $expected, got: $actual)\n"
  fi
}

# Assert that a boolean condition holds. Use this instead of passing an
# exit code around: `if cmd; then test_result "name" "true" "true"; else ... fi`
assert_true() {
  local name="$1"; shift
  if "$@"; then
    test_result "$name" "true" "true"
  else
    test_result "$name" "true" "false"
  fi
}

echo "═══════════════════════════════════════════════"
echo "  Neura E2E Test Suite — Live Production"
echo "═══════════════════════════════════════════════"
echo ""

# ─── 1. UNAUTHENTICATED REQUESTS ─────────────────
echo "▸ 1. Authentication"
echo "────────────────────"

R=$(curl -s -w "\n%{http_code}" "$BASE/api/memory")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
test_result "GET /api/memory without auth → 401" "401" "$CODE"
assert_true "Error body has 'unauthorized' code" \
  bash -c "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert d.get('error',{}).get('code')=='unauthorized'\" 2>/dev/null"

R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/memory" -H "Content-Type: application/json" -d '{"content":"test"}')
CODE=$(echo "$R" | tail -1)
test_result "POST /api/memory without auth → 401" "401" "$CODE"

R=$(curl -s -w "\n%{http_code}" -H "Authorization: Bearer invalid-key-12345" "$BASE/api/memory")
CODE=$(echo "$R" | tail -1)
test_result "GET /api/memory with bad key → 401" "401" "$CODE"

R=$(curl -s -w "\n%{http_code}" "$BASE/api/state")
CODE=$(echo "$R" | tail -1)
test_result "GET /api/state without auth → 401" "401" "$CODE"

R=$(curl -s -w "\n%{http_code}" "$BASE/api/credits")
CODE=$(echo "$R" | tail -1)
test_result "GET /api/credits without auth → 401" "401" "$CODE"

echo ""

# ─── 2. SIGNUP FLOW ──────────────────────────────
echo "▸ 2. Signup Flow"
echo "────────────────"

# Create a test user via Supabase Auth
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL is required}"
ANON_KEY="${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
TEST_EMAIL="e2e-test-$(date +%s)@neura.test"
TEST_PASS="TestPass123!"

# Sign up
R=$(curl -s -w "\n%{http_code}" -X POST "$SUPABASE_URL/auth/v1/signup" \
  -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASS\"}")
CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
test_result "Supabase signup → 200" "200" "$CODE"

# Extract access token
ACCESS_TOKEN=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))" 2>/dev/null)
if [ -z "$ACCESS_TOKEN" ]; then
  echo "  ⚠ Could not get access token — signup may require email confirmation"
  echo "    Body: $BODY"
  SKIP=$((SKIP+1))
  
  # Try auto-confirm via magic link or just sign in if user exists
  R=$(curl -s -w "\n%{http_code}" -X POST "$SUPABASE_URL/auth/v1/magiclink" \
    -H "apikey: $ANON_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\"}")
  SKIP=$((SKIP+1))
fi

if [ -n "$ACCESS_TOKEN" ]; then
  echo "  ✓ Got access token"
  
  # Get API key via /api/auth/me
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/auth/me" \
    -H "Authorization: Bearer $ACCESS_TOKEN")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "GET /api/auth/me → 200" "200" "$CODE"
  
  RAW_KEY=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('raw_key',''))" 2>/dev/null)
  CREDITS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('credits',0))" 2>/dev/null)
  TENANT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('user',{}).get('tenant_id',''))" 2>/dev/null)
  
  if [ -n "$RAW_KEY" ]; then
    echo "  ✓ Got raw API key: ${RAW_KEY:0:12}..."
    test_result "New user gets 1000 free credits" "1000" "$CREDITS"
  else
    echo "  ⚠ No raw_key returned (may be second call)"
  fi
fi

echo ""

# ─── 3. MEMORY CRUD (if we have a key) ───────────
if [ -n "$RAW_KEY" ]; then
  echo "▸ 3. Memory CRUD"
  echo "────────────────"
  
  # Store memory
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/memory" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: e2e-mem-1" \
    -d '{"content":"The capital of France is Paris","tags":["geography","facts"],"importance":8}')
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "POST /api/memory → 201" "201" "$CODE"
  
  MEM_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('id',''))" 2>/dev/null)
  echo "  Memory ID: $MEM_ID"
  
  # Check credit deduction
  REMAINING=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('meta',{}).get('credits_remaining','?'))" 2>/dev/null)
  echo "  Credits remaining: $REMAINING"
  
  # Store more memories for search testing
  for content in \
    "Python is a high-level programming language created by Guido van Rossum" \
    "The Eiffel Tower stands 330 meters tall in Paris, France" \
    "Machine learning is a subset of artificial intelligence" \
    "JavaScript runs in browsers and on servers via Node.js" \
    "The Great Wall of China is over 13000 miles long"; do
    curl -s -X POST "$BASE/api/memory" \
      -H "Authorization: Bearer $RAW_KEY" \
      -H "Content-Type: application/json" \
      -d "{\"content\":\"$content\"}" > /dev/null 2>&1
  done
  echo "  Stored 5 additional memories"
  
  # List memories
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/memory" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "GET /api/memory (list) → 200" "200" "$CODE"
  
  MEM_COUNT=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); a=d.get('data',d); a=a if isinstance(a,list) else a.get('memories',[]); print(len(a))" 2>/dev/null)
  echo "  Memories found: $MEM_COUNT"
  
  # Semantic search
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/memory?query=programming+language&limit=3" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "GET /api/memory?query= (semantic search) → 200" "200" "$CODE"
  
  # Advanced search
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/memory/search" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -d '{"query":"Paris France","limit":5}')
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "POST /api/memory/search (advanced) → 200" "200" "$CODE"
  
  # Update memory
  if [ -n "$MEM_ID" ]; then
    R=$(curl -s -w "\n%{http_code}" -X PATCH "$BASE/api/memory/$MEM_ID" \
      -H "Authorization: Bearer $RAW_KEY" \
      -H "Content-Type: application/json" \
      -d '{"content":"The capital of France is Paris (updated)","importance":9}')
    CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
    test_result "PATCH /api/memory/:id → 200" "200" "$CODE"
  fi
  
  # Summarize
  # The route requires memory_ids OR a query. Summarize the memories we
  # just stored by passing their id.
  SUM_IDS=$(curl -s "$BASE/api/memory?limit=5" -H "Authorization: Bearer $RAW_KEY" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); a=d.get('data',d); a=a if isinstance(a,list) else a.get('memories',[]); print(json.dumps([m['id'] for m in a]))" 2>/dev/null)
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/memory/summarize" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"memory_ids\":$SUM_IDS}")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "POST /api/memory/summarize → 200" "200" "$CODE"
  assert_true "Summarize returns total_memories" \
    bash -c "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert 'total_memories' in d.get('data',d)\" 2>/dev/null"
  
  echo ""
  
  # ─── 4. STATE CRUD ──────────────────────────────
  echo "▸ 4. State CRUD"
  echo "───────────────"
  
  # Upsert state
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/state" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -d '{"key":"e2e_test","value":{"step":1,"status":"running"}}')
  CODE=$(echo "$R" | tail -1)
  test_result "POST /api/state (upsert) → 201" "201" "$CODE"
  
  # Get state
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/state/e2e_test" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "GET /api/state/:key → 200" "200" "$CODE"
  assert_true "State value matches" \
  bash -c "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert d.get('data',d).get('value',{}).get('status')=='running'\" 2>/dev/null"
  
  # List state
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/state" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1)
  test_result "GET /api/state (list) → 200" "200" "$CODE"
  
  # Delete state
  R=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/state/e2e_test" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1)
  test_result "DELETE /api/state/:key → 200" "200" "$CODE"
  
  echo ""
  
  # ─── 5. CREDITS ─────────────────────────────────
  echo "▸ 5. Credits"
  echo "────────────"
  
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/credits" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "GET /api/credits → 200" "200" "$CODE"
  
  BALANCE=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('balance','?'))" 2>/dev/null)
  echo "  Current balance: $BALANCE credits"
  
  # Check x402 pricing info is present
  assert_true "Credits response has pricing" \
    bash -c "echo '$BODY' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert 'pricing' in d.get('data',d)\" 2>/dev/null"
  
  echo ""
  
  # ─── 6. IDEMPOTENCY ─────────────────────────────
  echo "▸ 6. Idempotency"
  echo "────────────────"
  
  IDEM_KEY="e2e-idem-$(date +%s)"
  curl -s -X POST "$BASE/api/memory" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEM_KEY" \
    -d '{"content":"Idempotency test memory"}' > /dev/null
  # The replay must return the cached response, flagged by the
  # X-Idempotency-Replayed header, and must not charge a second credit.
  R2=$(curl -s -D /tmp/e2e-idem-headers.txt -w "\n%{http_code}" -X POST "$BASE/api/memory" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -H "Idempotency-Key: $IDEM_KEY" \
    -d '{"content":"Idempotency test memory"}')
  CODE2=$(echo "$R2" | tail -1)
  test_result "Same idempotency key returns the same status" "201" "$CODE2"
  assert_true "Idempotent replay is flagged with X-Idempotency-Replayed" \
    grep -qi "x-idempotency-replayed" /tmp/e2e-idem-headers.txt
  rm -f /tmp/e2e-idem-headers.txt
  
  echo ""
  
  # ─── 7. WEBHOOKS ────────────────────────────────
  echo "▸ 7. Webhooks"
  echo "─────────────"
  
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/webhooks" \
    -H "Authorization: Bearer $RAW_KEY" \
    -H "Content-Type: application/json" \
    -d '{"url":"https://example.com/webhook","events":["memory.created"]}')
  CODE=$(echo "$R" | tail -1); BODY=$(echo "$R" | head -n -1)
  test_result "POST /api/webhooks (register) → 201" "201" "$CODE"
  
  WH_ID=$(echo "$BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('id',''))" 2>/dev/null)
  
  # List webhooks
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/webhooks" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1)
  test_result "GET /api/webhooks (list) → 200" "200" "$CODE"
  
  # Delete webhook
  if [ -n "$WH_ID" ]; then
    R=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/webhooks/$WH_ID" \
      -H "Authorization: Bearer $RAW_KEY")
    CODE=$(echo "$R" | tail -1)
    test_result "DELETE /api/webhooks/:id → 200" "200" "$CODE"
  fi
  
  echo ""
  
  # ─── 8. SHARING ─────────────────────────────────
  echo "▸ 8. Sharing"
  echo "────────────"
  
  if [ -n "$MEM_ID" ]; then
    R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/memory/$MEM_ID/share" \
      -H "Authorization: Bearer $RAW_KEY" \
      -H "Content-Type: application/json" \
      -d '{"target_tenant_id":"00000000-0000-0000-0000-000000000000","permission":"read"}')
    CODE=$(echo "$R" | tail -1)
    # The route requires target_tenant_id and returns 201. Sharing to a
    # non-existent tenant still succeeds (the share row is just orphaned),
    # so 201 is the expected status.
    test_result "POST /api/memory/:id/share → 201" "201" "$CODE"
    
    R=$(curl -s -w "\n%{http_code}" "$BASE/api/memory/$MEM_ID/share" \
      -H "Authorization: Bearer $RAW_KEY")
    CODE=$(echo "$R" | tail -1)
    test_result "GET /api/memory/:id/share → 200" "200" "$CODE"
  fi
  
  R=$(curl -s -w "\n%{http_code}" "$BASE/api/shared-with-me" \
    -H "Authorization: Bearer $RAW_KEY")
  CODE=$(echo "$R" | tail -1)
  test_result "GET /api/shared-with-me → 200" "200" "$CODE"
  
  echo ""
  
  # ─── 9. MEMORY DELETE ───────────────────────────
  echo "▸ 9. Cleanup"
  echo "────────────"
  
  if [ -n "$MEM_ID" ]; then
    R=$(curl -s -w "\n%{http_code}" -X DELETE "$BASE/api/memory/$MEM_ID" \
      -H "Authorization: Bearer $RAW_KEY")
    CODE=$(echo "$R" | tail -1)
    test_result "DELETE /api/memory/:id → 200" "200" "$CODE"
  fi
  
  echo ""
fi

# ─── 10. STATIC PAGES ────────────────────────────
echo "▸ 10. Static Pages & SEO"
echo "────────────────────────"

for PAGE in "/" "/docs" "/signup" "/openapi.yaml" "/robots.txt" "/sitemap.xml" "/favicon.svg"; do
  R=$(curl -s -w "\n%{http_code}" "$BASE$PAGE")
  CODE=$(echo "$R" | tail -1)
  test_result "GET $PAGE → 200" "200" "$CODE"
done

# Check JSON-LD schemas on landing page
assert_true "Landing page has JSON-LD schemas" \
  bash -c "curl -s '$BASE/' | grep -q 'application/ld+json'"

# Check sitemap has correct URLs
assert_true "Sitemap references the canonical domain" \
  bash -c "curl -s '$BASE/sitemap.xml' | grep -q 'neura'"

# Check OpenAPI spec
assert_true "OpenAPI spec is served" \
  bash -c "curl -s '$BASE/openapi.yaml' | grep -q 'openapi:'"

echo ""

# ─── 11. RATE LIMITING ───────────────────────────
echo "▸ 11. Rate Limit Headers"
echo "─────────────────────────"

if [ -n "$RAW_KEY" ]; then
  R=$(curl -s -D - -o /dev/null "$BASE/api/credits" -H "Authorization: Bearer $RAW_KEY")
  assert_true "Response has rate limit headers" \
    bash -c "echo '$R' | grep -qi 'x-ratelimit'"
  assert_true "Response has X-RateLimit-Limit" \
    bash -c "echo '$R' | grep -qi 'x-ratelimit-limit:'"
  assert_true "Response has X-RateLimit-Remaining" \
    bash -c "echo '$R' | grep -qi 'x-ratelimit-remaining:'"
else
  echo "  ⚠ Skipped (no API key)"
  SKIP=$((SKIP+1))
fi

echo ""

# ─── 12. ERROR FORMAT ────────────────────────────
echo "▸ 12. Error Format Consistency"
echo "──────────────────────────────"

assert_true "Error response has {error:{code,message}}" \
  bash -c "curl -s '$BASE/api/memory' -H 'Authorization: Bearer bad-key' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert 'error' in d and 'code' in d['error'] and 'message' in d['error']\" 2>/dev/null"

assert_true "State error follows same format" \
  bash -c "curl -s '$BASE/api/state/nonexistent' -H 'Authorization: Bearer bad-key' | python3 -c \"import sys,json; d=json.load(sys.stdin); assert 'error' in d\" 2>/dev/null"

echo ""

# ─── 13. WEBHOOK DELIVERY ────────────────────────
echo "▸ 13. Webhook Delivery"
echo "─────────────────────"

if [ -n "$RAW_KEY" ]; then
  R=$(curl -s -w "\n%{http_code}" -X POST "$BASE/api/webhooks" \
    -H "Authorization: Bearer $RAW_KEY" -H "Content-Type: application/json" \
    -d '{"url":"https://httpbin.org/post","events":["memory.created"]}')
  CODE=$(echo "$R" | tail -1)
  test_result "POST /api/webhooks → 201" "201" "$CODE"

  curl -s -X POST "$BASE/api/memory" \
    -H "Authorization: Bearer $RAW_KEY" -H "Content-Type: application/json" \
    -d '{"content":"webhook delivery e2e probe"}' > /dev/null

  if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    # Deliveries are fire-and-forget, so poll for up to ~30s. Scope the query
    # to this tenant so we assert on OUR delivery, not someone else's.
    DELIVERED=false
    for _ in 1 2 3 4 5 6; do
      sleep 5
      R=$(curl -s "$SUPABASE_URL/rest/v1/webhook_deliveries?select=event,status&tenant_id=eq.$TENANT_ID&order=attempted_at.desc&limit=1" \
        -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
      if echo "$R" | grep -q '"delivered"'; then
        DELIVERED=true
        break
      fi
    done
    assert_true "Webhook delivery logged as delivered" \
      bash -c "[ '$DELIVERED' = true ]"
  else
    echo "  ⚠ Skipped (SUPABASE_SERVICE_ROLE_KEY not set)"
    SKIP=$((SKIP+1))
  fi
else
  echo "  ⚠ Skipped (no API key)"
  SKIP=$((SKIP+1))
fi

echo ""

# ─── CLEANUP ─────────────────────────────────────
# Remove the test user and its tenant so repeated runs do not pollute
# auth.users, api_keys, memories, credit_balances, usage_logs, etc.
echo "▸ 14. Cleanup"
echo "────────────"

if [ -n "$ACCESS_TOKEN" ]; then
  UID_RESP=$(curl -s "$SUPABASE_URL/auth/v1/user" -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ACCESS_TOKEN")
  USER_ID=$(echo "$UID_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('id',''))" 2>/dev/null)
  if [ -n "$USER_ID" ] && [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    curl -s -X DELETE "$SUPABASE_URL/auth/v1/admin/users/$USER_ID" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" > /dev/null
    echo "  ✓ Deleted test user $USER_ID"
  else
    echo "  ⚠ Could not delete test user (set SUPABASE_SERVICE_ROLE_KEY to enable cleanup)"
  fi
fi

if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ] && [ -n "$TENANT_ID" ]; then
  for T in api_keys memories state_store usage_logs credit_transactions credit_balances webhooks webhook_deliveries shared_memories; do
    curl -s -X DELETE "$SUPABASE_URL/rest/v1/$T?tenant_id=eq.$TENANT_ID" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" > /dev/null
  done
  echo "  ✓ Deleted tenant rows for $TENANT_ID"
else
  echo "  ⚠ Skipped tenant row cleanup (SUPABASE_SERVICE_ROLE_KEY and TENANT_ID required)"
fi

echo ""

# ═══ SUMMARY ═══════════════════════════════════════
echo "═══════════════════════════════════════════════"
echo "  RESULTS"
echo "═══════════════════════════════════════════════"
echo -e "$RESULTS"
echo "  Passed:  $PASS"
echo "  Failed:  $FAIL"
echo "  Skipped: $SKIP"
echo "═══════════════════════════════════════════════"

if [ $FAIL -eq 0 ]; then
  echo "  ✓ ALL TESTS PASSED"
else
  echo "  ✗ SOME TESTS FAILED"
fi
