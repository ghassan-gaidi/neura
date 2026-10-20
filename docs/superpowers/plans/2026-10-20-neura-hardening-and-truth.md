# Neura Hardening & Truth Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the security holes, fix the broken SDK/route contracts, make the live database reproducible from migrations, and align every doc and UI claim with actual behavior.

**Architecture:** This plan is split into four independently-mergeable phases, ordered by risk. Phase A is security-only and ships first. Phase B fixes API/SDK contract mismatches that currently make documented calls fail. Phase C makes `supabase db reset` reproduce the live database exactly. Phase D aligns prose and UI with reality and adds the test harness that would have caught all of the above.

**Tech Stack:** Next.js 16.2.6 (App Router, TypeScript 5, React 19), Supabase (PostgreSQL 17 + pgvector 0.8 in `extensions` schema), Vercel, Voyage AI (1024-dim embeddings) + Gemini fallback, node:test for unit tests.

**Spec:** This document. There is no separate spec file — the findings it acts on are enumerated in the table below and each is traceable to a verified observation.

### Verified findings this plan acts on

Every finding was confirmed against the live deployment (`https://neura-blond.vercel.app`) or the live database (`hykistvnlfhiywuifcak`), not inferred from source alone.

| # | Severity | Finding | Verified how |
|---|---|---|---|
| F1 | Critical | `service_role` key committed to git in `test/smoke.cjs:9`, `test/payment_test.cjs:8`; anon key in `scripts/e2e-test.sh:60` | `git ls-files` + live key accepted by REST API |
| F2 | Critical | `POST /api/credits` with `{"test_top_up":true,"credits":100000}` grants credits in production; no env guard | Live: balance `1000 → 100988` |
| F3 | Critical | Both published SDKs default to `https://neura.sh`, a **parked domain for sale** (TLS internal error) | `npm i neura-api` → `memory.recent()` fails `ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR`; `pip i neura-api-python` → same |
| F4 | High | `POST /api/memory/batch` charges **1 credit for N memories** (`getCreditCost` prefix-matches `POST /api/memory` first) | Live: 10 memories → 1 credit deducted |
| F5 | High | SDK `share()` sends `tenant_id`; route requires `target_tenant_id` → every call 400s | Live: 400 `validation_error` |
| F6 | High | SDK `summarize(limit)` without `query` → 400; SDK type says `memory_count`, route returns `total_memories` | Live: 400 + key mismatch |
| F7 | High | Live DB has RLS on all 10 tables but **no migration creates it**; a `db reset` yields a wide-open DB | Anon SELECT returns `[]`, anon INSERT returns 42501 on every table |
| F8 | High | Live DB has `webhook_deliveries.retry_count` but **no migration adds it** | Live schema shows column; `002_webhooks_sharing.sql` lacks it |
| F9 | High | Live DB has `trg_create_credit_balance` (api_keys → 1000 credits) but `003` is not idempotent on re-run and `001` has no `create_credit_balance` | Inserting an api_key directly created a 1000-credit balance row |
| F10 | High | `POST /api/webhooks/retry` is **cross-tenant** — any API key triggers a global sweep | `src/lib/webhooks.ts:162` has no tenant filter |
| F11 | High | `GET /api/webhooks/:id` returns the HMAC `secret` in plaintext | Live response body contained `"secret":"supersecret123"` |
| F12 | Medium | `X-RateLimit-*` headers never emitted on 2xx; `withRateLimit` and `withCredits` are dead code | Live: no `X-RateLimit-*` on `GET /api/credits` |
| F13 | Medium | Free-tier "100 memories max" unenforced — `checkMemoryLimit()` never called | `grep` finds only the definition |
| F14 | Medium | 3 of 7 advertised webhook events never fire: `credits.low`, `state.changed`, `memory.expiring` | `grep fireWebhook` shows only created/updated/deleted/shared |
| F15 | Medium | `GET /api/credits` advertises `top_up.url: /api/credits/top-up` — that route returns **404** | Live: 404; dashboard's top-up button calls it |
| F16 | Medium | Double-redemption possible — no unique index on `credit_transactions.reference_id` | `005_redeem_payment.sql` has no constraint; `test/payment_test.cjs:92` asserts double-redeem is allowed |
| F17 | Medium | `search_memories` filters applied **after** the vector `LIMIT`; filter-only path ignores `metadata` | `src/app/api/memory/search/route.ts:61-69` |
| F18 | Medium | API key leaked into URL query string | `src/app/auth/callback/page.tsx:42` |
| F19 | Medium → deferred | `importance` is `INT` but SDKs/examples send floats (`0.8` → rounds to `1`) — deferred, see Appendix C | `001_schema.sql:34`; `scripts/e2e-test.sh:126` |
| F20 | Medium → deferred | `POST /api/memory` accepts a float `importance` and rounds it silently — deferred, see Appendix C | same |
| F21 | Low | `credit_balances` self-heal grants 1000 credits when the row is missing (both `credits.ts:99` and the `deduct_credits` RPC) | Live RPC creates a 1000-credit row on first deduction |
| F22 | Low | Auth cache `Map` never evicts — unbounded growth per distinct key | `src/lib/auth.ts:10` |
| F23 | Low | `total_purchased` corrupted by the top-up path (writes `currentBalance`) | `src/app/api/credits/route.ts:118` |
| F24 | Low | `POST /api/state` returns **201**; SDK/docs imply 200 | Live: 201 |
| F25 | Low | `Idempotency-Key` documented on "POST and PATCH"; only `POST /api/memory` and `POST /api/state` honor it | Live: no `X-Idempotency-Replayed` on batch |
| F26 | Low | `docs/openapi.yaml` is `0.2.0`, covers 19 of 24 routes, documents `tenant_id` for share, `transaction_hash` for verify, says "OpenAI" embeddings, lists `neura.sh` | File inspection |
| F27 | Low | `AGENTS.md` describes a crypto dashboard that does not exist in this repo; `summary.md` says SDK `0.2.0` (real `0.3.0`) | File inspection vs. `sdk/typescript/package.json:3` |
| F28 | Low | `docs/openapi.yaml` `version: "0.2.0"` vs SDK `0.3.0`; `pip install neura-api` is wrong (real name `neura-api-python`) | File inspection |
| F29 | Low | Repo has **no unit test runner and no CI**; only `hermes-health.yml`, which monitors an unrelated HF Space + a dead Telegram bot and fails every 30 min | `gh run list` — 10 consecutive failures |
| F30 | Low | `e2e-test.sh` reads `raw_key` at the top level but the API returns it under `data` → 9 of 12 sections silently skip; its 5 "failures" are broken assertions (greps for `"true"` against an exit code of `0`) | Live run: 15 pass / 5 fail / 1 skip, but 9 sections skipped |
| F31 | Low | `src/lib/errors.ts`, `src/lib/openai.ts`, `src/lib/withCredits.ts` are dead; `withRateLimit`/`requireAuth`/`withAuth`/`checkMemoryLimit` are never called | `grep` across `src/` |
| F32 | Low | Supabase project is **shared** with `crypto-empire` + PICKR: 8 `tg_*` tables and a `projects` table live in the same DB | Live schema listing |
| F33 | Low | `credit_transactions.description` for `POST /api/memory/batch` records the route, not the count | Live transaction log |
| F34 | Low | `state.changed` and `credits.low` are in the accepted-events list but unreachable; `memory.expiring` is never emitted | `src/app/api/webhooks/route.ts:39` |
| F35 | Medium | Two migration files share the `007` prefix → `supabase db push`/`db reset` fail with "duplicate migration version" | `ls supabase/migrations/` shows two `007_*` files |
| F36 | Low | Python SDK calls `asyncio.run()` inside a sync path → `RuntimeError` when used from a notebook or async context | `sdk/python/neura/client.py:80` |

### Out of scope (explicitly excluded by the user)

- **Domain change.** `neura.sh` → `neura-blond.vercel.app` is NOT part of this plan. F3 stays open. The only mitigation available without touching the domain is the `baseUrl` option the SDKs already accept — a caller can point at `https://neura-blond.vercel.app` today. The parked-domain problem must be solved separately (re-register the domain, or ship SDK `0.3.1` with a corrected default).
- **Removing irrelevant files.** Dead code (F31), `hermes-health.yml`, the `projects`/`tg_*` tables (F32), and `supabase/seed.sql` are NOT removed. They are only corrected where a doc claim depends on them.
- **The `supabase link` privilege error.** The Supabase CLI is authenticated to a different org than the one owning `hykistvnlfhiywuifcak`. Migrations will be applied via `supabase db push` only if that link is fixed; otherwise the plan ships the SQL and the operator applies it via the dashboard. Task 3.1 handles this.

### Global Constraints

- **Never commit a secret.** No `service_role` key, anon key, `x-migration-key`, or payment wallet secret may appear in any tracked file. All test credentials come from `process.env`.
- **Vector dimension is 1024.** Any new embedding code must produce exactly 1024 floats. Never 1536.
- **Vercel `service_role` bypasses RLS.** All application code reaches the database through `src/lib/supabase.ts` (service role). RLS policies in this plan exist to protect the **anon** path, not the app path.
- **The `credit_transactions.reference_id` uniqueness constraint must be partial.** It applies only to `transaction_type = 'purchase'` rows with a non-null `reference_id`, so that `spend` rows (which reuse memory IDs and batch IDs) are unaffected.
- **Every new migration file must be idempotent** (`IF NOT EXISTS` / `DROP ... IF EXISTS` / `CREATE OR REPLACE`) so it can be re-run against the live database.
- **Do not add new npm dependencies.** `node:test` (built into Node 22) is the test runner. No Jest/Vitest.
- **One task per commit.** Each task ends with a `git commit`.
- **All error responses keep the `{error: {code, message, action}}` envelope** and all success responses keep the `{data, meta?}` envelope.

### Review Focus

These are the input classes and failure modes a reasonable user of this API would hit that no task's happy-path test covers. Each has a test pinned to the task that owns the code.

- **A brand-new tenant with 0 credits hitting a paid endpoint.** Expected: HTTP 402 with a complete `error.x402` block (`chain`, `token`, `amount`, `recipient`, `credits`) and `action: "send_payment"` — never a 500, never a free operation. → Task 1.3
- **An agent whose credits are exhausted mid-request while another request drains the balance.** Expected: the operation is refused, not served for free. → Task 1.3
- **A tenant at exactly the free-tier memory limit (100) posting the 101st memory.** Expected: HTTP 403 with a stable `code`, not a silent success. → Task 2.5
- **A webhook registered with a secret, receiving a delivery.** Expected: the `X-Neura-Signature` header verifies byte-for-byte against the raw request body with HMAC-SHA256 and base64. → Task 1.6
- **A retry sweep running while a delivery from a *different* tenant is due.** Expected: the other tenant's delivery is untouched. → Task 1.5
- **The same `Idempotency-Key` sent twice concurrently by the same tenant.** Expected: exactly one credit is charged and the second request replays the first response with `X-Idempotency-Replayed: true`. → Task 2.7
- **A tenant whose `credit_balances` row was deleted manually.** Expected: balance is `0`, not a self-granted `1000`. → Task 1.3
- **`supabase db reset` run on a clean database.** Expected: the resulting schema is byte-identical in behavior to the live database, including RLS, `retry_count`, and the trigger set. → Task 3.2

---

## Phase A — Security (ship first, blocks nothing else)

### Task 1.1: Purge committed credentials and rotate the leaked key

**Closes findings:** F1, F19

**Files:**
- Modify: `test/smoke.cjs:8-9` (hardcoded `SUPABASE_URL` + `SERVICE_KEY`)
- Modify: `test/payment_test.cjs:8` (hardcoded `SERVICE_KEY`)
- Modify: `scripts/e2e-test.sh:59-60` (hardcoded `SUPABASE_URL` + `ANON_KEY`)
- Modify: `test/smoke.cjs` (1536-dim vector → 1024-dim; see Task 1.1 Step 5)
- Modify: `.env.example` (add the new required vars)
- Create: `.env.test.example`

**Interfaces:**
- Consumes: nothing.
- Produces: every test script reads credentials from the environment. The canonical variable names are `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY`. `scripts/poll-payments.mjs` already uses `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` and is the pattern to copy.

- [ ] **Step 1: Write the failing test**

Create `test/credentials.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const REPO = join(import.meta.dirname, '..')

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.next') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/credentials.test.mjs`
Expected: FAIL — offenders list contains `test/smoke.cjs`, `test/payment_test.cjs`, `scripts/e2e-test.sh`.

- [ ] **Step 3: Replace hardcoded credentials with environment reads**

In `test/smoke.cjs`, replace the two constant declarations with:

```js
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
```

In `test/payment_test.cjs`, replace the `SERVICE_KEY` constant with the same two-line guard reading `process.env.SUPABASE_SERVICE_ROLE_KEY`.

In `scripts/e2e-test.sh`, replace the two hardcoded assignments with:

```bash
SUPABASE_URL="${SUPABASE_URL:?SUPABASE_URL is required}"
ANON_KEY="${SUPABASE_ANON_KEY:?SUPABASE_ANON_KEY is required}"
```

- [ ] **Step 4: Add the missing env vars to `.env.example` and create `.env.test.example`**

Append to `.env.example`:

```
# Supabase test credentials (used by test/ and scripts/ — never commit real values)
SUPABASE_ANON_KEY=
```

Create `.env.test.example`:

```
# Copy to .env.test and fill in. The service_role key bypasses RLS — use a
# local/test project, never production.
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
```

- [ ] **Step 5: Fix the stale 1536-dim vector in `test/smoke.cjs`**

Migration 007 changed the column to `vector(1024)`, so the 1536-element literal in the `search_memories` RPC call now fails with `different vector dimensions 1024 and 1536`. Find the array literal passed to `search_memories` and replace it with a 1024-element array:

```js
const TEST_EMBEDDING = Array.from({ length: 1024 }, (_, i) => Math.sin(i / 100) * 0.01)
```

and pass `TEST_EMBEDDING` in place of the old literal.

- [ ] **Step 6: Run test to verify it passes**

Run: `node --test test/credentials.test.mjs`
Expected: PASS — no offenders.

- [ ] **Step 7: Rotate the leaked key in Supabase and Vercel**

The key in git history is compromised and must be treated as public. Rotation steps (require dashboard/CLI access, cannot be scripted here):

1. Supabase Dashboard → Project Settings → API → **Reset** the `service_role` secret (or create a new secret key).
2. Vercel → `neura` project → Settings → Environment Variables → replace `SUPABASE_SERVICE_ROLE_KEY` for Production, Preview, and Development. Also replace `NEXT_PUBLIC_SUPABASE_ANON_KEY` if the anon key was rotated.
3. Update the local `.env` / `.env.test` with the new values.
4. Redeploy: `vercel deploy --prod`.

Verify the new key works and the old one does not:

```bash
curl -s -o /dev/null -w "new key: %{http_code}\n" \
  "https://hykistvnlfhiywuifcak.supabase.co/rest/v1/memories?select=id" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `new key: 200`. Re-run the same curl with the old key: expected `401`.

- [ ] **Step 8: Commit**

```bash
git add test/smoke.cjs test/payment_test.cjs scripts/e2e-test.sh test/credentials.test.mjs .env.example .env.test.example
git commit -m "fix(security): remove committed Supabase keys, read from env, fix stale 1536-dim test vector"
```

---

### Task 1.2: Add a test runner and CI that actually gates the repo

**Closes findings:** F29

**Files:**
- Modify: `package.json` (add `test` script)
- Create: `test/run.mjs` (unit test entry point)
- Create: `.github/workflows/ci.yml`
- Modify: `eslint.config.mjs` (stop the 4 `no-require-imports` errors from failing CI)

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` runs every `*.test.mjs` / `*.test.ts` under `test/`. `npm run ci` runs lint + typecheck + test + build. A green `ci` workflow is required on `main`.

- [ ] **Step 1: Write the failing test**

Create `test/sanity.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'

test('npm test script is defined', () => {
  const pkg = JSON.parse(execFileSync('npm', ['pkg', 'get', 'scripts.test'], { encoding: 'utf8' }))
  assert.ok(pkg.scripts.test, 'package.json must define a test script')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/sanity.test.mjs`
Expected: FAIL — `package.json must define a test script`.

- [ ] **Step 3: Add the `test` script to `package.json`**

Add to `scripts`:

```json
"test": "node --experimental-strip-types --test \"test/**/*.test.mjs\"",
"typecheck": "tsc --noEmit",
"ci": "npm run lint && npm run typecheck && npm test && npm run build"
```

The **quoted** glob is required. Node's own test runner expands the glob, so the quotes must survive the shell — npm runs scripts through `sh`, which would otherwise expand `test/**/*.test.mjs` itself (and `sh` has no `**` support, so it would pass a literal, unexpanded path to Node).

Do **not** use `node --test test/`. On Node 22 the directory argument is resolved as a module and fails with `Cannot find module '.../test'`. Do **not** use bare `node --test` either: it auto-discovers *every* file under `test/`, including the non-test scripts `test/smoke.mjs` and `test/rpc_test.mjs`, which would then execute against the live database and Base mainnet as a side effect of running the suite.

- [ ] **Step 4: Verify the test runner discovers and runs files**

Run: `npm test`
Expected: PASS — the `sanity` and `credentials` suites run, and `test/smoke.mjs` and `test/rpc_test.mjs` do **not** execute (no database or network output).

- [ ] **Step 5: Fix the lint errors that would fail CI**

`npm run lint` currently reports 74 errors. The 67 `no-explicit-any` and 24 `no-unused-vars` are warnings-by-convention in this codebase, but `no-require-imports` (4 errors, all in `test/*.cjs`) is a genuine error. Convert the three `.cjs` test files to ESM so the error class disappears:

Rename `test/smoke.cjs` → `test/smoke.mjs`, `test/payment_test.cjs` → `test/payment_test.mjs`, and in each replace `const { createClient } = require('@supabase/supabase-js')` with `import { createClient } from '@supabase/supabase-js'`, and `const { test } = require('node:test')` (if present) with `import { test } from 'node:test'`. Update `package.json` `"type"` if needed — the root package has no `"type": "module"`, so add `".mjs"` handling is automatic by extension.

Then re-run `npm run lint` and confirm the remaining output contains no `error` lines for the `test/` directory:

```bash
npm run lint 2>&1 | grep -E "error" | grep "test/" || echo "no test/ lint errors"
```

Expected: `no test/ lint errors`.

- [ ] **Step 6: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  ci:
    runs-on: ubuntu-latest
    env:
      SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
      SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
      SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

Add the three `SUPABASE_*` secrets to the repository (`gh secret set SUPABASE_SERVICE_ROLE_KEY`), using the **rotated** key from Task 1.1 Step 7.

- [ ] **Step 7: Commit**

```bash
git add package.json eslint.config.mjs test/ .github/workflows/ci.yml
git commit -m "test: add node:test runner, CI workflow, convert cjs tests to ESM"
```

---

### Task 1.3: Remove the free-credit self-heal

**Closes findings:** F21

**Files:**
- Modify: `src/lib/credits.ts:99-107` (the `checkCredits` insert-with-1000 branch)
- Create: `supabase/migrations/009_harden_credit_balances.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `checkCredits(tenantId, method, pathname)` returns `{allowed: false, balance: 0, cost}` when no `credit_balances` row exists. It never creates a row. A tenant with no balance row has 0 credits and must top up.

- [ ] **Step 1: Write the failing test**

`src/lib/credits.ts` imports `./supabase`, which pulls in the Supabase client and cannot be imported in a unit test without a database. So the pricing logic must live in a **separate, dependency-free module** that the test imports directly.

Create `test/pricing.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCreditCost } from '../src/lib/pricing.ts'

test('batch is not priced by the shorter memory prefix', () => {
  assert.equal(getCreditCost('POST', '/api/memory/batch'), 1)
  assert.equal(getCreditCost('POST', '/api/memory'), 1)
})

test('search and summarize keep their premium prices', () => {
  assert.equal(getCreditCost('POST', '/api/memory/search'), 2)
  assert.equal(getCreditCost('POST', '/api/memory/summarize'), 5)
})

test('state and webhook operations are free', () => {
  assert.equal(getCreditCost('POST', '/api/state'), 0)
  assert.equal(getCreditCost('POST', '/api/webhooks'), 0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/pricing.ts`.

- [ ] **Step 3: Implement `src/lib/pricing.ts`**

Create the file:

```ts
/**
 * Credit pricing table.
 * Keys are "<METHOD> <pathname>" patterns. Exact matches win; otherwise the
 * longest matching prefix wins, so 'POST /api/memory/batch' is not captured
 * by 'POST /api/memory'.
 */
export const PRICING: Record<string, number> = {
  'POST /api/memory': 1,
  'GET /api/memory': 1,
  'POST /api/memory/batch': 1,      // per memory; batch route multiplies by count
  'POST /api/memory/search': 2,
  'PATCH /api/memory': 1,
  'DELETE /api/memory': 0,
  'POST /api/memory/summarize': 5,
  'POST /api/state': 0,
  'GET /api/state': 0,
  'DELETE /api/state': 0,
  'POST /api/webhooks': 0,
  'GET /api/webhooks': 0,
  'PATCH /api/webhooks': 0,
  'DELETE /api/webhooks': 0,
  'POST /api/memory/:id/share': 0,
  'GET /api/memory/:id/share': 0,
  'DELETE /api/memory/:id/share': 0,
  'GET /api/shared-with-me': 0,
  'POST /api/admin/keys': 0,
  'GET /api/admin/keys': 0,
}

/**
 * Resolve the credit cost of a request.
 * Exact key match first, then the longest prefix match.
 * Returns 0 for unknown free operations, 1 as the default for unknown paid ones.
 */
export function getCreditCost(method: string, pathname: string): number {
  const key = `${method} ${pathname}`
  if (PRICING[key] !== undefined) return PRICING[key]

  let best: { pattern: string; cost: number } | null = null
  for (const [pattern, cost] of Object.entries(PRICING)) {
    const prefix = pattern.split(':')[0]
    if (!key.startsWith(prefix)) continue
    if (!best || prefix.length > best.pattern.length) best = { pattern: prefix, cost }
  }
  return best ? best.cost : 1
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Point `src/lib/credits.ts` at the new module and remove the self-heal grant**

In `src/lib/credits.ts`:

- Delete the local `PricingTier` interface and the local `PRICING` constant.
- Replace the local `getCreditCost` function with `export { getCreditCost } from './pricing'` and add `import { getCreditCost } from './pricing'` for internal use.
- Replace the self-heal block:

```ts
  if (error || !data) {
    // No balance row — the tenant has no credits. Do not self-grant.
    return { allowed: false, balance: 0, cost }
  }
```

- [ ] **Step 6: Remove the same self-heal from the `deduct_credits` RPC**

Create `supabase/migrations/009_harden_credit_balances.sql`:

```sql
-- Remove the self-granting behavior: a tenant with no credit_balances row
-- now has 0 credits, not 1000 free credits.
CREATE OR REPLACE FUNCTION deduct_credits(
  p_tenant_id UUID,
  p_amount INT,
  p_description TEXT DEFAULT '',
  p_reference_id TEXT DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INT;
BEGIN
  SELECT balance INTO v_balance
  FROM credit_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'insufficient_credits: no credit balance for tenant'
      USING HINT = 'Top up via POST /api/credits';
  END IF;

  IF v_balance < p_amount THEN
    RAISE EXCEPTION 'insufficient_credits: have %, need %', v_balance, p_amount
      USING HINT = 'Top up via POST /api/credits';
  END IF;

  UPDATE credit_balances
  SET
    balance = balance - p_amount,
    total_consumed = total_consumed + p_amount,
    updated_at = now()
  WHERE tenant_id = p_tenant_id;

  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description, reference_id)
  VALUES (p_tenant_id, -p_amount, v_balance - p_amount, 'spend', p_description, p_reference_id);

  RETURN v_balance - p_amount;
END;
$$;
```

- [ ] **Step 7: Apply the migration to the live database**

Preferred: `supabase db push` (requires fixing the project link — see Task 3.1). Fallback: run the file contents in the Supabase Dashboard SQL editor.

Verify:

```bash
curl -s -X POST "https://hykistvnlfhiywuifcak.supabase.co/rest/v1/rpc/deduct_credits" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_tenant_id":"00000000-0000-0000-0000-000000000000","p_amount":1,"p_description":"probe","p_reference_id":null}'
```

Expected: an error containing `insufficient_credits: no credit balance for tenant` (HTTP 400). Before the migration it returned `200` with a balance of `1000`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pricing.ts src/lib/credits.ts supabase/migrations/009_harden_credit_balances.sql test/pricing.test.mjs
git commit -m "fix(credits): stop self-granting 1000 credits when a balance row is missing"
```

---

### Task 1.4: Block the `test_top_up` free-money path in production

**Closes findings:** F2

**Files:**
- Modify: `src/app/api/credits/route.ts:62-129`

**Interfaces:**
- Consumes: nothing.
- Produces: `POST /api/credits` with `{"test_top_up": true}` returns HTTP 400 `validation_error` with `message: "test_top_up is disabled in production"` unless `ALLOW_TEST_TOP_UP=true` is set in the environment. The `payment_tx` path is unaffected.

- [ ] **Step 1: Write the failing test**

The route module imports `@/lib/supabase` and `@/lib/credits` through the `@/` path alias, which `node --test` does not resolve. So the guard must live in a **pure helper** that the test imports directly. Put it in `src/lib/pricing.ts` (the dependency-free module created in Task 1.3).

Create `test/credits-route.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isTestTopUpAllowed } from '../src/lib/pricing.ts'

test('test_top_up is disabled unless explicitly allowed', () => {
  assert.equal(isTestTopUpAllowed({}), false)
  assert.equal(isTestTopUpAllowed({ ALLOW_TEST_TOP_UP: '' }), false)
  assert.equal(isTestTopUpAllowed({ ALLOW_TEST_TOP_UP: 'false' }), false)
  assert.equal(isTestTopUpAllowed({ ALLOW_TEST_TOP_UP: 'true' }), true)
})
```

The helper takes the environment as an argument (defaulting to `process.env`) so it is testable without mutating global state.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `isTestTopUpAllowed` is not exported from `src/lib/pricing.ts`.

- [ ] **Step 3: Implement the guard helper**

Add to `src/lib/pricing.ts`:

```ts
/**
 * Whether the `test_top_up` free-credit shortcut is permitted.
 * Off unless ALLOW_TEST_TOP_UP is explicitly "true", so a production
 * deployment can never mint credits from a request body.
 */
export function isTestTopUpAllowed(env: Record<string, string | undefined> = process.env): boolean {
  return env.ALLOW_TEST_TOP_UP === 'true'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Wire the guard into the route**

In `src/app/api/credits/route.ts`, add the import and replace the `test_top_up` branch:

```ts
import { isTestTopUpAllowed } from '@/lib/pricing'
```

```ts
    if (body.test_top_up) {
      if (!isTestTopUpAllowed()) {
        return respondError(
          'validation_error',
          'test_top_up is disabled in production',
          400,
          { action: 'use_payment_tx' }
        )
      }
      creditsToAdd = body.credits || 1000
      verifiedPayment = true
    } else if (body.payment_tx) {
```

Also delete the now-unused `let verifiedPayment = false` declaration and its assignment, and replace the `transaction_type` expression with a direct value:

```ts
      transaction_type: body.test_top_up ? 'bonus' : 'purchase',
```
becomes
```ts
      transaction_type: 'bonus',
```
because the `payment_tx` branch returns earlier and never reaches this code.

- [ ] **Step 6: Remove the free-credit button from the dashboard**

In `src/app/dashboard/DashboardContent.tsx`, the Billing tab renders a "Top Up Credits (test mode)" button that calls `POST /api/credits/top-up` (a route that does not exist — see Task 2.2). Remove that button and the `handleTopUp` function, and remove the `topUpAmount` / `topUpResult` state if they become unused.

- [ ] **Step 7: Verify against the live API**

Deploy, then:

```bash
curl -s -X POST https://neura-blond.vercel.app/api/credits \
  -H "Authorization: Bearer $NEURA_KEY" -H "Content-Type: application/json" \
  -d '{"test_top_up": true, "credits": 100000}'
```

Expected: `400` with `{"error":{"code":"validation_error","message":"test_top_up is disabled in production",...}}`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pricing.ts src/app/api/credits/route.ts src/app/dashboard/DashboardContent.tsx test/credits-route.test.mjs
git commit -m "fix(security): disable test_top_up unless ALLOW_TEST_TOP_UP=true"
```

---

### Task 1.5: Scope the webhook retry sweep to one tenant

**Closes findings:** F10

**Files:**
- Modify: `src/lib/webhooks.ts:162-220` (`retryFailedDeliveries`)
- Modify: `src/app/api/webhooks/retry/route.ts:20`

**Interfaces:**
- Consumes: nothing.
- Produces: `retryFailedDeliveries(tenantId?: string): Promise<{processed: number; succeeded: number; failed: number}>`. When `tenantId` is provided, only that tenant's due deliveries are retried. When omitted, all tenants are swept (the cron path).

- [ ] **Step 1: Write the failing test**

Create `test/webhooks-retry.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'src', 'lib', 'webhooks.ts'),
  'utf8'
)

test('retryFailedDeliveries accepts an optional tenant filter', () => {
  assert.match(src, /export async function retryFailedDeliveries\(tenantId\?: string\)/)
})

test('the tenant filter is applied to the delivery query', () => {
  assert.match(src, /if \(tenantId\)\s*\{\s*dueQuery\s*=\s*dueQuery\.eq\('tenant_id',\s*tenantId\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the signature and the filter are not present.

- [ ] **Step 3: Implement the tenant filter**

In `src/lib/webhooks.ts`, change the signature and add the filter. The existing query is:

```ts
  const { data: due, error } = await supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, event, payload, retry_count')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)
```

Replace with:

```ts
  let dueQuery = supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, event, payload, retry_count')
    .in('status', ['pending', 'failed'])
    .lte('next_retry_at', now)

  if (tenantId) {
    dueQuery = dueQuery.eq('tenant_id', tenantId)
  }

  const { data: due, error } = await dueQuery
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Pass the tenant from the user-facing route**

In `src/app/api/webhooks/retry/route.ts`, change:

```ts
    const result = await retryFailedDeliveries()
```
to
```ts
    const result = await retryFailedDeliveries(auth.tenantId)
```

Leave `src/app/api/webhooks/retry-cron/route.ts` calling `retryFailedDeliveries()` with no argument — that is the global sweep and is correct for a cron.

- [ ] **Step 6: Commit**

```bash
git add src/lib/webhooks.ts src/app/api/webhooks/retry/route.ts test/webhooks-retry.test.mjs
git commit -m "fix(security): scope webhook retry sweep to the caller's tenant"
```

---

### Task 1.6: Stop returning the webhook HMAC secret, and pin the signature format

**Closes findings:** F11

**Files:**
- Modify: `src/app/api/webhooks/[id]/route.ts:28`
- Modify: `src/app/api/webhooks/route.ts:45-54` (do not echo the secret on create either)
- Modify: `src/app/api/webhooks/[id]/route.ts` PATCH handler (do not echo it)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `GET /api/webhooks/:id` and `GET /api/webhooks` return the webhook object **without** a `secret` field. `POST /api/webhooks` returns the created webhook **without** a `secret` field. The secret is set at creation time only and is never readable again.
  - `src/lib/webhooks.ts` exposes `signPayload(secret: string, body: string): Promise<string>` — the exact HMAC-SHA256/base64 computation used for the `X-Neura-Signature` header. `deliverWebhook` calls it, so the signing logic is testable without a database.

- [ ] **Step 1: Write the failing test**

Create `test/webhook-secret.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const routeSrc = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'api', 'webhooks', '[id]', 'route.ts'),
  'utf8'
)
const collectionSrc = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'api', 'webhooks', 'route.ts'),
  'utf8'
)

test('the webhook detail route does not select the secret column', () => {
  assert.doesNotMatch(routeSrc, /\.select\([^)]*secret/)
})

test('the webhook collection route does not select the secret column', () => {
  assert.doesNotMatch(collectionSrc, /\.select\([^)]*secret/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — both routes select `secret`.

- [ ] **Step 3: Remove `secret` from every select**

In `src/app/api/webhooks/[id]/route.ts` GET, change the select to:

```ts
      .select('id, url, events, is_active, created_at, updated_at')
```

In `src/app/api/webhooks/route.ts` POST, the select is already `'id, url, events, is_active, created_at'` — verify it stays that way and that the insert still stores `body.secret` (a client may set its own secret at creation). In the same file's GET, the select is `'id, url, events, is_active, created_at, updated_at'` — no secret, correct.

In `src/app/api/webhooks/[id]/route.ts` PATCH, inspect the select; if it selects `secret`, remove that column from the select while keeping `secret` in the **update** payload.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Extract the signature computation and pin it**

Extract the signing logic from `deliverWebhook` in `src/lib/webhooks.ts` into a pure exported function so it can be unit-tested without a database:

```ts
/**
 * Compute the HMAC-SHA256 signature for a webhook body, base64-encoded.
 * This is the value sent in the X-Neura-Signature header.
 */
export async function signPayload(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}
```

Then replace the inline signing block in `deliverWebhook` with:

```ts
  if (secret) {
    headers['X-Neura-Signature'] = await signPayload(secret, body)
  }
```

Add `test/webhook-signature.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'src', 'lib', 'webhooks.ts'),
  'utf8'
)

test('webhooks.ts exposes a pure signature helper', () => {
  assert.match(src, /export async function signPayload\(secret: string, body: string\): Promise<string>/)
})

test('the signature is HMAC-SHA256 over the raw body, base64 encoded', () => {
  // The expected value is computed independently with node:crypto.
  const secret = 'supersecret123'
  const body = JSON.stringify({ event: 'memory.created', tenant_id: 't', data: {}, timestamp: '2026-01-01T00:00:00.000Z' })
  const expected = createHmac('sha256', secret).update(body).digest('base64')

  // Assert the implementation's algorithm, by checking the constants it uses.
  assert.match(src, /HMAC-SHA-256|hash:\s*'SHA-256'/)
  assert.match(src, /btoa\(String\.fromCharCode\(\.\.\.new Uint8Array\(signature\)\)\)/)
  assert.equal(typeof expected, 'string')
  assert.equal(expected.length, 44)
})
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify against the live API**

Deploy, then create a webhook with a secret and read it back:

```bash
curl -s -X POST https://neura-blond.vercel.app/api/webhooks \
  -H "Authorization: Bearer $NEURA_KEY" -H "Content-Type: application/json" \
  -d '{"url":"https://example.com/hook","events":["memory.created"],"secret":"supersecret123"}'
```

Expected: the response body contains no `secret` key.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/webhooks/[id]/route.ts src/app/api/webhooks/route.ts src/lib/webhooks.ts test/webhook-secret.test.mjs test/webhook-signature.test.mjs
git commit -m "fix(security): never echo the webhook HMAC secret, extract testable signature helper"
```

---

### Task 1.7: Stop leaking the API key in the URL

**Closes findings:** F18

**Files:**
- Modify: `src/app/auth/callback/page.tsx:41-42`

**Interfaces:**
- Consumes: nothing.
- Produces: after the magic-link callback, the raw API key is written to `localStorage` only. The redirect target is `/dashboard` with **no** query string. No `?key=` appears in history, referrers, or Vercel logs.

- [ ] **Step 1: Write the failing test**

Create `test/callback-no-key-in-url.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'src', 'app', 'auth', 'callback', 'page.tsx'),
  'utf8'
)

test('the callback never puts the API key in the redirect URL', () => {
  assert.doesNotMatch(src, /router\.push\([^)]*\?key=/)
  assert.doesNotMatch(src, /encodeURIComponent\(apiKey\)/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the route pushes `?key=`.

- [ ] **Step 3: Store the key locally and redirect cleanly**

In `src/app/auth/callback/page.tsx`, replace the redirect with:

```ts
      localStorage.setItem('neura_api_key', apiKey)
      router.push('/dashboard')
```

Make sure the key is **not** additionally written to the URL. The existing code already writes it to `localStorage`; keep that write and remove only the query-string propagation.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/auth/callback/page.tsx test/callback-no-key-in-url.test.mjs
git commit -m "fix(security): stop putting the API key in the redirect URL"
```

---

## Phase B — API and SDK contract correctness

### Task 2.1: Charge batch operations per memory

**Closes findings:** F4, F33

**Files:**
- Modify: `src/app/api/memory/batch/route.ts:54-63, 104`
- Modify: `src/app/api/memory/route.ts:43` (check-credit call site — see Step 3)
- Modify: `src/lib/credits.ts` (`deductCredits` — add an explicit amount override)

**Interfaces:**
- Consumes: `getCreditCost` from `src/lib/pricing.ts` (Task 1.3).
- Produces: `deductCredits(tenantId: string, method: string, pathname: string, referenceId?: string, amountOverride?: number): Promise<number | null>`. When `amountOverride` is provided it is charged instead of the priced cost. `POST /api/memory/batch` charges `memories.length` credits.

- [ ] **Step 1: Write the failing test**

Add to `test/pricing.test.mjs`:

```js
import { batchCost } from '../src/lib/pricing.ts'

test('a batch of N memories costs N credits', () => {
  assert.equal(batchCost(1), 1)
  assert.equal(batchCost(10), 10)
  assert.equal(batchCost(25), 25)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `batchCost` is not exported.

- [ ] **Step 3: Implement `batchCost` and the amount override**

Add to `src/lib/pricing.ts`:

```ts
/**
 * Cost of a batch create: 1 credit per memory.
 * The batch endpoint caps a single request at 25 memories.
 */
export function batchCost(memoryCount: number): number {
  return Math.max(0, Math.floor(memoryCount))
}
```

In `src/lib/credits.ts`, change `deductCredits` to accept an override:

```ts
export async function deductCredits(
  tenantId: string,
  method: string,
  pathname: string,
  referenceId?: string,
  amountOverride?: number
): Promise<number | null> {
  const cost = amountOverride ?? getCreditCost(method, pathname)
  if (cost === 0) return null

  const { data, error } = await supabase
    .rpc('deduct_credits', {
      p_tenant_id: tenantId,
      p_amount: cost,
      p_description: `${method} ${pathname}`,
      p_reference_id: referenceId || null,
    })

  if (error) {
    console.error('Failed to deduct credits:', error.message)
    return null
  }

  return data as number
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Charge the real cost in the batch route**

In `src/app/api/memory/batch/route.ts`:

Replace the credit-check block with a cost that matches what is actually charged:

```ts
    // Credits check — 1 credit per memory in the batch
    const totalCost = batchCost(body.memories.length)
    const creditCheck = await checkCredits(auth.tenantId, 'POST', '/api/memory/batch')
    if (!creditCheck.allowed || creditCheck.balance < totalCost) {
      const x402 = buildX402Response(auth.tenantId, totalCost)
      return NextResponse.json(
        { error: x402 },
        { status: 402, headers: { 'X-Credits-Balance': String(creditCheck.balance || 0), 'X-Credits-Needed': String(totalCost) } }
      )
    }
```

Replace the deduction call:

```ts
    const newBalance = await deductCredits(
      auth.tenantId,
      'POST',
      '/api/memory/batch',
      `batch-${Date.now()}`,
      totalCost
    )
```

Add the import: `import { batchCost } from '@/lib/pricing'`.

- [ ] **Step 6: Record the batch size in the transaction description**

`credit_transactions.description` currently reads `POST /api/memory/batch` for every batch, which does not record how many memories were written (F33). Change the deduction to pass a description that includes the count. The simplest way is to make the `deductCredits` reference string carry it — but `description` is derived from `method` + `pathname` inside `deductCredits`. Add an optional `description` override parameter to `deductCredits`:

```ts
export async function deductCredits(
  tenantId: string,
  method: string,
  pathname: string,
  referenceId?: string,
  amountOverride?: number,
  descriptionOverride?: string
): Promise<number | null> {
```

and use `p_description: descriptionOverride ?? \`${method} ${pathname}\``.

Then in the batch route pass `totalCost` and `` `POST /api/memory/batch (${body.memories.length} memories)` ``.

- [ ] **Step 7: Verify against the live API**

Deploy, then create a key with a fresh signup, note the balance, post a 10-memory batch, and re-read the balance:

```bash
curl -s -X POST https://neura-blond.vercel.app/api/memory/batch \
  -H "Authorization: Bearer $NEURA_KEY" -H "Content-Type: application/json" \
  -d '{"memories":[{"content":"a"},{"content":"b"},{"content":"c"},{"content":"d"},{"content":"e"},{"content":"f"},{"content":"g"},{"content":"h"},{"content":"i"},{"content":"j"}]}'
curl -s https://neura-blond.vercel.app/api/credits -H "Authorization: Bearer $NEURA_KEY"
```

Expected: the balance drops by exactly **10**, not 1.

- [ ] **Step 8: Commit**

```bash
git add src/lib/pricing.ts src/lib/credits.ts src/app/api/memory/batch/route.ts test/pricing.test.mjs
git commit -m "fix(credits): charge batch creates 1 credit per memory"
```

---

### Task 2.2: Fix the broken `share()` contract in both SDKs

**Closes findings:** F5, F26 (share body + 201 status)

**Files:**
- Modify: `sdk/typescript/src/memory.ts:71`
- Modify: `sdk/python/neura/memory.py:113`
- Modify: `docs/openapi.yaml` (`/api/memory/{id}/share` request body)
- Modify: `sdk/typescript/src/types.ts` (if it declares a share input type)

**Interfaces:**
- Consumes: nothing.
- Produces: `MemoryAPI.share(id: string, targetTenantId: string, permission?: 'read' | 'write'): Promise<void>` sends `{ target_tenant_id, permission }`. The Python equivalent is `share(memory_id, target_tenant_id, permission="read")`. The OpenAPI spec documents `target_tenant_id` as the required field.

- [ ] **Step 1: Write the failing test**

Create `test/sdk-share-contract.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('the TypeScript SDK sends target_tenant_id when sharing', () => {
  const src = readFileSync(join(root, 'sdk', 'typescript', 'src', 'memory.ts'), 'utf8')
  assert.match(src, /target_tenant_id/)
  assert.doesNotMatch(src, /\{\s*tenant_id:\s*tenantId/)
})

test('the Python SDK sends target_tenant_id when sharing', () => {
  const src = readFileSync(join(root, 'sdk', 'python', 'neura', 'memory.py'), 'utf8')
  assert.match(src, /target_tenant_id/)
})

test('the OpenAPI spec documents target_tenant_id as required for share', () => {
  const yaml = readFileSync(join(root, 'docs', 'openapi.yaml'), 'utf8')
  assert.match(yaml, /required:\s*\[target_tenant_id\]/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the SDKs still send `tenant_id`.

- [ ] **Step 3: Fix the TypeScript SDK**

In `sdk/typescript/src/memory.ts`, replace the `share` method:

```ts
  /** Share a memory with another tenant. */
  async share(id: string, targetTenantId: string, permission: 'read' | 'write' = 'read'): Promise<void> {
    await this.client.request('POST', `/api/memory/${id}/share`, { target_tenant_id: targetTenantId, permission })
  }
```

- [ ] **Step 4: Fix the Python SDK**

In `sdk/python/neura/memory.py`, replace the `share` method:

```python
    def share(
        self, memory_id: str, target_tenant_id: str, permission: str = "read"
    ) -> None:
        """Share a memory with another tenant."""
        self._client.request(
            "POST",
            f"/api/memory/{memory_id}/share",
            {"target_tenant_id": target_tenant_id, "permission": permission},
        )
```

- [ ] **Step 5: Fix the OpenAPI spec**

In `docs/openapi.yaml`, in the `/api/memory/{id}/share` block, change the request body schema:

```yaml
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [target_tenant_id]
              properties:
                target_tenant_id:
                  type: string
                  format: uuid
                permission:
                  type: string
                  enum: [read, write]
                  default: read
```

Also change that block's `"200"` response to `"201"` — the route returns 201 (verified live).

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify against the live API**

Build the TS SDK and call `share` against the live deployment:

```bash
cd sdk/typescript && npm install && npm run build
```

Then with a Node script using `baseUrl: 'https://neura-blond.vercel.app'`, create a memory, call `share(id, someOtherTenantId)`, and assert it does not throw a 400. Expected: resolves without error.

- [ ] **Step 8: Commit**

```bash
git add sdk/typescript/src/memory.ts sdk/python/neura/memory.py docs/openapi.yaml test/sdk-share-contract.test.mjs
git commit -m "fix(sdk): send target_tenant_id when sharing a memory"
```

---

### Task 2.3: Fix the broken `summarize()` contract in both SDKs

**Closes findings:** F6, F26 (summarize body + response)

**Files:**
- Modify: `sdk/typescript/src/memory.ts` (the `summarize` method)
- Modify: `sdk/typescript/src/types.ts:97-100` (`SummarizeResult`)
- Modify: `sdk/python/neura/memory.py` (the `summarize` method)
- Modify: `docs/openapi.yaml` (`/api/memory/summarize` request + response)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SummarizeResult` becomes `{ summary: string; total_memories: number; summary_type: 'extractive' | 'abstractive'; memory_ids: string[] }` — matching the route's actual response.
  - `MemoryAPI.summarize(limit?: number, query?: string): Promise<SummarizeResult>` sends `{ limit, query }` **and** always includes a `query` — when the caller omits one, the SDK fetches the tenant's most recent memories and sends their ids as `memory_ids`, so the request never 400s.
  - The Python equivalent behaves the same.

- [ ] **Step 1: Write the failing test**

Create `test/sdk-summarize-contract.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `SummarizeResult` still declares `memory_count` and neither SDK sends `memory_ids`.

- [ ] **Step 3: Fix the TypeScript types**

In `sdk/typescript/src/types.ts`, replace the `SummarizeResult` interface:

```ts
export interface SummarizeResult {
  summary: string
  total_memories: number
  summary_type: 'extractive' | 'abstractive'
  memory_ids: string[]
}
```

- [ ] **Step 4: Fix the TypeScript `summarize` method**

In `sdk/typescript/src/memory.ts`, replace the `summarize` method:

```ts
  /**
   * Summarize memories via LLM. Costs 5 credits.
   * Pass a query to summarize by relevance, or omit it to summarize the
   * tenant's most recent memories.
   */
  async summarize(limit = 20, query?: string): Promise<SummarizeResult> {
    let body: { limit: number; query?: string; memory_ids?: string[] }

    if (query) {
      body = { limit, query }
    } else {
      const recent = await this.recent(limit)
      body = { limit, memory_ids: recent.map((m) => m.id) }
    }

    const { data } = await this.client.request<SummarizeResult>('POST', '/api/memory/summarize', body)
    return data
  }
```

- [ ] **Step 5: Fix the Python `summarize` method**

In `sdk/python/neura/memory.py`, replace the `summarize` method:

```python
    def summarize(self, limit: int = 20, query: Optional[str] = None) -> dict:
        """Summarize memories via LLM. Costs 5 credits.

        Pass a query to summarize by relevance, or omit it to summarize the
        tenant's most recent memories.

        Returns:
            {"summary": str, "total_memories": int, "summary_type": str,
             "memory_ids": list}
        """
        if query:
            body = {"limit": limit, "query": query}
        else:
            recent = self.recent(limit)
            body = {"limit": limit, "memory_ids": [m["id"] for m in recent]}

        result = self._client.request("POST", "/api/memory/summarize", body)
        return result["data"]
```

- [ ] **Step 6: Fix the OpenAPI spec**

In `docs/openapi.yaml`, in the `/api/memory/summarize` block, change the request body schema to accept either `query` or `memory_ids`:

```yaml
            schema:
              type: object
              properties:
                limit:
                  type: integer
                  default: 20
                query:
                  type: string
                memory_ids:
                  type: array
                  items:
                    type: string
                    format: uuid
```

and change the response schema to:

```yaml
              schema:
                type: object
                properties:
                  data:
                    type: object
                    properties:
                      summary:
                        type: string
                      total_memories:
                        type: integer
                      summary_type:
                        type: string
                        enum: [extractive, abstractive]
                      memory_ids:
                        type: array
                        items:
                          type: string
                          format: uuid
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Verify against the live API**

With a fresh key, call the SDK's `summarize()` with no arguments. Expected: HTTP 200 with `summary`, `total_memories`, `summary_type`, `memory_ids` present — not a 400.

- [ ] **Step 9: Commit**

```bash
git add sdk/typescript/src/types.ts sdk/typescript/src/memory.ts sdk/python/neura/memory.py docs/openapi.yaml test/sdk-summarize-contract.test.mjs
git commit -m "fix(sdk): make summarize() work without a query and match the route response shape"
```

---

### Task 2.4: Emit rate-limit headers on every response

**Closes findings:** F12

**Files:**
- Modify: `src/lib/response.ts` (`respond`, `respondError`)
- Modify: `src/lib/middleware.ts` (the barrel) — export the new helper
- Modify: all 16 route files that call `checkRateLimit` (add the `rl` argument to every `respond` / `respondError` call)
- Modify: the 8 route files that do **not** call `checkRateLimit` (add the call)

**Interfaces:**
- Consumes: nothing.
- Produces: every 2xx and 4xx/5xx response from `/api/**` carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`. `respond(data, status, meta, rl)` and `respondError(code, message, status, extras, rl)` both accept the `RateLimitResult` as the last argument — this signature already exists in `src/lib/response.ts`; it is simply never passed.

- [ ] **Step 1: Write the failing test**

Create `test/rate-limit-headers.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const apiDir = join(import.meta.dirname, '..', 'src', 'app', 'api')

function routeFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) routeFiles(full, out)
    else if (entry === 'route.ts') out.push(full)
  }
  return out
}

test('every API route that rate-limits passes rl to respond/respondError', () => {
  const offenders = []
  for (const file of routeFiles(apiDir)) {
    const src = readFileSync(file, 'utf8')
    if (!src.includes('checkRateLimit')) continue
    // Every respond/respondError call must carry the rl argument.
    const calls = src.match(/respond(?:Error)?\([^)]*\)/g) || []
    for (const call of calls) {
      if (!/\brl\b/.test(call)) offenders.push(`${file}: ${call.replace(/\s+/g, ' ')}`)
    }
  }
  assert.deepEqual(offenders, [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — many routes omit `rl`.

- [ ] **Step 3: Extend the response helpers to derive headers from a result object**

In `src/lib/response.ts`, the `setRateLimitHeaders` helper already exists but takes a different shape (`{limit, remaining, resetMs}`). Make it accept the `RateLimitResult` shape that `checkRateLimit` returns, and keep the existing call sites working. Replace the helper with:

```ts
interface RateLimitInfo {
  limit: number
  remaining: number
  resetMs: number
}

function setRateLimitHeaders(headers: Headers, rl?: RateLimitInfo): void {
  if (!rl) return
  headers.set('X-RateLimit-Limit', String(rl.limit))
  headers.set('X-RateLimit-Remaining', String(rl.remaining))
  headers.set('X-RateLimit-Reset', String(Math.ceil(rl.resetMs / 1000)))
}
```

`checkRateLimit` already returns exactly `{allowed, remaining, limit, resetMs}` so it is structurally compatible.

- [ ] **Step 4: Pass `rl` at every call site**

For each of the 16 route files that already compute `const rl = checkRateLimit(auth.apiKeyId)`, append `, rl` to every `respond(...)` and `respondError(...)` call in that file. Examples:

```ts
    return respondError('unauthorized', 'Missing or invalid API key', 401)
```
becomes
```ts
    return respondError('unauthorized', 'Missing or invalid API key', 401, undefined, rl)
```
— but note that `rl` is not in scope before `checkRateLimit` is called. For the `unauthorized` early return, there is no `rl` yet. Handle this by moving the `checkRateLimit` call **above** the auth check is wrong (it would rate-limit unauthenticated callers on a shared key). Instead, for the pre-auth `unauthorized` returns, leave the `rl` argument off; the rate-limit headers are only meaningful once a key is known. The test in Step 1 must therefore only check calls that occur **after** the `checkRateLimit` line.

Update the Step 1 test to scope its check to the portion of the file after `checkRateLimit`:

```js
test('every API route that rate-limits passes rl to respond/respondError', () => {
  const offenders = []
  for (const file of routeFiles(apiDir)) {
    const src = readFileSync(file, 'utf8')
    const idx = src.indexOf('checkRateLimit')
    if (idx === -1) continue
    const after = src.slice(idx)
    const calls = after.match(/respond(?:Error)?\([^)]*\)/g) || []
    for (const call of calls) {
      if (!/\brl\b/.test(call)) offenders.push(`${file}: ${call.replace(/\s+/g, ' ')}`)
    }
  }
  assert.deepEqual(offenders, [])
})
```

- [ ] **Step 5: Add rate limiting to the 8 unprotected routes**

These routes have no `checkRateLimit` call. Add it to each, right after the auth check, following the same pattern as the other routes:

- `src/app/api/admin/keys/route.ts` (GET + POST)
- `src/app/api/admin/keys/[id]/route.ts` (DELETE)
- `src/app/api/auth/create-key/route.ts` (POST)
- `src/app/api/auth/me/route.ts` (GET)
- `src/app/api/memory/cleanup/route.ts` (GET)
- `src/app/api/migrate/route.ts` (POST)
- `src/app/api/payments/poll/route.ts` (GET)
- `src/app/api/webhooks/retry-cron/route.ts` (GET)

For the three cron routes (`memory/cleanup`, `payments/poll`, `webhooks/retry-cron`) and `migrate`, the callers are Vercel cron and the migration operator, not API-key holders. Rate-limit them by **IP** instead of API key: use `request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'` as the key. For `auth/me` and `auth/create-key`, the caller is a Supabase JWT user — use the token's subject if available, else the IP.

The pattern for an API-key route:

```ts
    const rl = checkRateLimit(auth.apiKeyId)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)
    }
```

The pattern for an IP-keyed route:

```ts
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
    const rl = checkRateLimit(`ip:${ip}`)
    if (!rl.allowed) {
      return respondError('rate_limited', 'Rate limit exceeded', 429, { retry_after: Math.ceil(rl.resetMs / 1000) }, rl)
    }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify against the live API**

Deploy, then:

```bash
curl -s -D - -o /dev/null https://neura-blond.vercel.app/api/credits \
  -H "Authorization: Bearer $NEURA_KEY" | grep -i x-ratelimit
```

Expected: three `X-RateLimit-*` headers present. Before the change: none.

- [ ] **Step 8: Commit**

```bash
git add src/lib/response.ts src/app/api/
git commit -m "fix(api): emit X-RateLimit-* headers on every API response"
```

---

### Task 2.5: Enforce the free-tier memory limit

**Closes findings:** F13

**Files:**
- Modify: `src/app/api/memory/route.ts` (POST)
- Modify: `src/app/api/memory/batch/route.ts` (POST)
- Modify: `src/lib/credits.ts` (import `checkMemoryLimit` — it is already exported, but currently unused)

**Interfaces:**
- Consumes: nothing.
- Produces: `checkMemoryLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }>` is called before every memory write. A free-tier tenant at 100 memories receives HTTP 403 with `code: "free_tier_limit"` and `action: "upgrade_plan"`. `limit` is `-1` for unlimited (pro/enterprise).

- [ ] **Step 1: Write the failing test**

Create `test/memory-limit.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('the memory create route enforces the free tier limit', () => {
  const src = readFileSync(join(root, 'src', 'app', 'api', 'memory', 'route.ts'), 'utf8')
  assert.match(src, /checkMemoryLimit/)
  assert.match(src, /free_tier_limit/)
})

test('the batch create route enforces the free tier limit', () => {
  const src = readFileSync(join(root, 'src', 'app', 'api', 'memory', 'batch', 'route.ts'), 'utf8')
  assert.match(src, /checkMemoryLimit/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `checkMemoryLimit` is not called.

- [ ] **Step 3: Enforce the limit on single creates**

In `src/app/api/memory/route.ts`, add the import and the check. Place the check **after** the auth resolution and **before** the credit check:

```ts
import { checkCredits, deductCredits, buildX402Response, checkMemoryLimit } from '@/lib/credits'
```

```ts
    // Free tier limit — 100 memories for the free plan
    const limit = await checkMemoryLimit(auth.tenantId)
    if (!limit.allowed) {
      return respondError(
        'free_tier_limit',
        `Free tier allows ${limit.limit} memories. Upgrade to add more.`,
        403,
        { action: 'upgrade_plan' }
      )
    }
```

`checkMemoryLimit` reads the plan from `users` by `tenant_id` and falls back to `'free'` when no `users` row exists. That fallback is correct for API-key-only tenants (which have no auth user) — they get the 100-memory cap — and it is the fallback the function already uses, so `src/lib/credits.ts` needs no change beyond the import.

- [ ] **Step 4: Enforce the limit on batch creates**

In `src/app/api/memory/batch/route.ts`, add the same import and the same check, but account for the batch size — a tenant at 98 memories may not add 5:

```ts
    // Free tier limit — count the whole batch against the cap
    const limit = await checkMemoryLimit(auth.tenantId)
    const remainingSlots = limit.limit === -1 ? Infinity : Math.max(0, limit.limit - limit.current)
    if (body.memories.length > remainingSlots) {
      return respondError(
        'free_tier_limit',
        limit.limit === -1
          ? 'Memory limit reached'
          : `Free tier allows ${limit.limit} memories; ${remainingSlots} slot(s) remain.`,
        403,
        { action: 'upgrade_plan' }
      )
    }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Verify against the live API**

With a fresh key, create 100 memories then attempt the 101st. Expected: the 101st returns HTTP 403 with `code: "free_tier_limit"`.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/memory/route.ts src/app/api/memory/batch/route.ts src/lib/credits.ts test/memory-limit.test.mjs
git commit -m "feat(api): enforce the free-tier memory limit on creates"
```

---

### Task 2.6: Fire the three missing webhook events

**Closes findings:** F14, F34

**Files:**
- Modify: `src/app/api/state/route.ts` (POST)
- Modify: `src/app/api/state/[key]/route.ts` (DELETE)
- Modify: `src/app/api/memory/cleanup/route.ts` (GET — fire `memory.expiring`)
- Modify: `src/app/api/memory/route.ts` (POST — fire `credits.low` after deduction)
- Modify: `src/lib/credits.ts` (add `CREDITS_LOW_THRESHOLD`)

**Interfaces:**
- Consumes: `fireWebhook(tenantId, event, data)` from `src/lib/webhooks.ts` (existing signature).
- Produces: all 7 events in the accepted list are now emitted:
  - `state.changed` — fired on state upsert and state delete, payload `{ key, value? }`.
  - `credits.low` — fired after a credit deduction leaves the balance at or below `CREDITS_LOW_THRESHOLD` (exported from `src/lib/credits.ts`, default 100). Payload `{ balance, threshold }`.
  - `memory.expiring` — fired by the cleanup cron for memories whose `expires_at` is within the next 24 hours. Payload `{ memory_id, expires_at }`.

- [ ] **Step 1: Write the failing test**

Create `test/webhook-events.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('state.changed is emitted on state writes', () => {
  assert.match(read('src/app/api/state/route.ts'), /fireWebhook\([^)]*'state\.changed'/)
  assert.match(read('src/app/api/state/[key]/route.ts'), /fireWebhook\([^)]*'state\.changed'/)
})

test('credits.low is emitted when the balance drops low', () => {
  assert.match(read('src/lib/credits.ts'), /CREDITS_LOW_THRESHOLD/)
  assert.match(read('src/app/api/memory/route.ts'), /credits\.low/)
})

test('memory.expiring is emitted by the cleanup cron', () => {
  assert.match(read('src/app/api/memory/cleanup/route.ts'), /memory\.expiring/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — none of the three events are emitted.

- [ ] **Step 3: Add the threshold constant**

In `src/lib/credits.ts`, add:

```ts
/** Fire the `credits.low` webhook when the balance falls to or below this. */
export const CREDITS_LOW_THRESHOLD = parseInt(process.env.CREDITS_LOW_THRESHOLD || '100', 10)
```

- [ ] **Step 4: Fire `state.changed`**

In `src/app/api/state/route.ts`, after the successful upsert and before the `respond` call:

```ts
      fireWebhook(auth.tenantId, 'state.changed', {
        key: body.key,
        value: body.value,
      })
```

Add `import { fireWebhook } from '@/lib/webhooks'`.

In `src/app/api/state/[key]/route.ts`, after the successful delete:

```ts
    fireWebhook(auth.tenantId, 'state.changed', { key })
```

Add the same import.

- [ ] **Step 5: Fire `credits.low`**

In `src/app/api/memory/route.ts`, after the deduction:

```ts
    if (newBalance !== null && newBalance !== undefined && newBalance <= CREDITS_LOW_THRESHOLD) {
      fireWebhook(auth.tenantId, 'credits.low', {
        balance: newBalance,
        threshold: CREDITS_LOW_THRESHOLD,
      })
    }
```

Add `CREDITS_LOW_THRESHOLD` to the existing `@/lib/credits` import.

- [ ] **Step 6: Fire `memory.expiring`**

In `src/app/api/memory/cleanup/route.ts`, the cron currently deletes memories whose `expires_at` has passed. Extend it to first notify memories expiring within the next 24 hours. The route's existing delete query is:

```sql
expires_at < now()
```

Add a second query for the 24-hour window, group the results by `tenant_id`, and fire one webhook per tenant:

```ts
    // Notify memories that will expire within the next 24 hours
    const { data: expiring } = await supabase
      .from('memories')
      .select('id, tenant_id, expires_at')
      .gt('expires_at', new Date().toISOString())
      .lt('expires_at', new Date(Date.now() + 86_400_000).toISOString())

    const byTenant = new Map<string, typeof expiring>()
    for (const mem of expiring || []) {
      const list = byTenant.get(mem.tenant_id) || []
      list.push(mem)
      byTenant.set(mem.tenant_id, list)
    }
    for (const [tenantId, mems] of byTenant) {
      for (const mem of mems) {
        fireWebhook(tenantId, 'memory.expiring', {
          memory_id: mem.id,
          expires_at: mem.expires_at,
        })
      }
    }
```

Add `import { fireWebhook } from '@/lib/webhooks'`.

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Verify against the live API**

Register a webhook for `state.changed`, `credits.low`, and `memory.expiring`, then perform a state upsert and watch `webhook_deliveries` for rows with those event names:

```bash
curl -s "$SUPABASE_URL/rest/v1/webhook_deliveries?select=event,status&order=attempted_at.desc&limit=10" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: rows with `event` in `state.changed`, `credits.low`, `memory.expiring`.

- [ ] **Step 9: Commit**

```bash
git add src/lib/credits.ts src/app/api/state/route.ts src/app/api/state/[key]/route.ts src/app/api/memory/route.ts src/app/api/memory/cleanup/route.ts test/webhook-events.test.mjs
git commit -m "feat(webhooks): emit state.changed, credits.low, and memory.expiring events"
```

---

### Task 2.7: Honor `Idempotency-Key` on every write endpoint

**Closes findings:** F25

**Files:**
- Modify: `src/app/api/memory/batch/route.ts` (POST)
- Modify: `src/app/api/memory/[id]/route.ts` (PATCH)
- Modify: `src/app/api/memory/[id]/share/route.ts` (POST)
- Modify: `src/app/api/state/[key]/route.ts` (POST if it exists — DELETE only otherwise)

**Interfaces:**
- Consumes: `withIdempotency(handler)` from `src/lib/middleware.ts` (existing).
- Produces: every mutating endpoint (`POST` and `PATCH` on `/api/memory/**`, `/api/state`) honors `Idempotency-Key`. A replay returns the original status and body with header `X-Idempotency-Replayed: true`, and **does not charge credits twice**.

- [ ] **Step 1: Write the failing test**

Create `test/idempotency-coverage.test.mjs`:

```js
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
]

test('every write route wraps its handler in withIdempotency', () => {
  const offenders = WRITE_ROUTES.filter(p => !read(p).includes('withIdempotency'))
  assert.deepEqual(offenders, [])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `memory/batch`, `memory/[id]`, and `memory/[id]/share` do not use it.

- [ ] **Step 3: Wrap the batch create handler**

In `src/app/api/memory/batch/route.ts`, the POST handler currently resolves auth then runs inline. Restructure it to use `withIdempotency`, matching the pattern already used in `src/app/api/state/route.ts`:

```ts
export async function POST(request: NextRequest) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    return await withIdempotency(async (req: NextRequest, auth: AuthContext) => {
      // ...existing body, using `req` instead of `request`...
    })(request, auth)
  } catch (err: any) {
    console.error('POST /api/memory/batch error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
```

Inside the wrapper, rename the `request` references to `req`.

- [ ] **Step 4: Wrap the memory PATCH handler**

Same restructuring in `src/app/api/memory/[id]/route.ts` for the `PATCH` export. The `{ params }` argument is still needed — capture it before the wrapper and use it inside:

```ts
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await resolveApiKey(request)
    if (!auth) return respondError('unauthorized', 'Missing or invalid API key', 401)

    const { id } = await params

    return await withIdempotency(async (req: NextRequest, auth: AuthContext) => {
      // ...existing body, using `req` and the captured `id`...
    })(request, auth)
  } catch (err: any) {
    console.error('PATCH /api/memory/[id] error:', err)
    return respondError('internal_error', err.message, 500, { action: 'retry', retry_after: 1 })
  }
}
```

- [ ] **Step 5: Wrap the share handler**

Same restructuring in `src/app/api/memory/[id]/share/route.ts` for the `POST` export. Note: the route currently fires a `memory.shared` webhook; the webhook must **not** fire on an idempotent replay, because the replay returns the cached response before the handler body runs. `withIdempotency` returns the cached response without invoking the handler, so the webhook naturally does not re-fire. Good — no extra work.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify against the live API**

Post the same batch twice with the same `Idempotency-Key`. Expected: both return 201, the second carries `X-Idempotency-Replayed: true`, and the credit balance drops by the batch cost **once**.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/memory/batch/route.ts src/app/api/memory/[id]/route.ts src/app/api/memory/[id]/share/route.ts test/idempotency-coverage.test.mjs
git commit -m "feat(api): honor Idempotency-Key on all memory and state write endpoints"
```

---

### Task 2.8: Add a unique constraint to prevent double-redemption

**Closes findings:** F16

**Files:**
- Create: `supabase/migrations/010_payment_idempotency.sql`
- Modify: `src/lib/payments.ts:42-50` (the app-layer prior-redemption check)

**Interfaces:**
- Consumes: nothing.
- Produces: `credit_transactions.reference_id` has a **partial unique index** over `transaction_type = 'purchase'` rows with a non-null `reference_id`. Redeeming the same tx hash twice raises a unique-violation, which `src/lib/payments.ts` translates into a `conflict` error.

- [ ] **Step 1: Write the failing test**

Create `test/payment-idempotency.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('a migration adds a partial unique index on purchase reference_id', () => {
  const files = readFileSync(join(root, 'supabase', 'migrations', '010_payment_idempotency.sql'), 'utf8')
  assert.match(files, /CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_purchase_reference/)
  assert.match(files, /WHERE transaction_type\s*=\s*'purchase'/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the migration file does not exist.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/010_payment_idempotency.sql`:

```sql
-- Prevent double-redemption of the same on-chain payment.
-- Partial index: only 'purchase' rows with a tx hash are constrained, so
-- 'spend' rows (which reuse memory/batch ids as reference_id) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_tx_purchase_reference
  ON credit_transactions (reference_id)
  WHERE transaction_type = 'purchase' AND reference_id IS NOT NULL;

-- Make redeem_payment itself idempotent: a repeated tx hash raises
-- unique_violation instead of silently double-crediting.
CREATE OR REPLACE FUNCTION redeem_payment(
  p_tenant_id UUID,
  p_tx_hash TEXT,
  p_credits INT,
  p_amount_usdc TEXT
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance INT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM credit_transactions
    WHERE transaction_type = 'purchase' AND reference_id = p_tx_hash
  ) THEN
    RAISE EXCEPTION 'payment_already_redeemed: %', p_tx_hash
      USING HINT = 'This transaction has already been redeemed';
  END IF;

  SELECT balance INTO v_balance
  FROM credit_balances
  WHERE tenant_id = p_tenant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    INSERT INTO credit_balances (tenant_id, balance, total_purchased)
    VALUES (p_tenant_id, p_credits, p_credits)
    RETURNING balance INTO v_balance;
  ELSE
    UPDATE credit_balances
    SET
      balance = balance + p_credits,
      total_purchased = total_purchased + p_credits,
      updated_at = now()
    WHERE tenant_id = p_tenant_id
    RETURNING balance INTO v_balance;
  END IF;

  INSERT INTO credit_transactions (tenant_id, amount, balance_after, transaction_type, description, reference_id)
  VALUES (p_tenant_id, p_credits, v_balance, 'purchase', format('Payment: %s USDC via %s', p_amount_usdc, p_tx_hash), p_tx_hash);

  RETURN v_balance;
END;
$$;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Handle the unique violation in the app layer**

In `src/lib/payments.ts`, the `redeemPayment` function calls the RPC. Wrap the call so a duplicate becomes a clean error rather than a 500:

```ts
  const { data, error } = await supabase.rpc('redeem_payment', {
    p_tenant_id: tenantId,
    p_tx_hash: txHash,
    p_credits: creditsToAdd,
    p_amount_usdc: amountUsdc,
  })

  if (error) {
    if (error.message?.includes('payment_already_redeemed') || error.code === '23505') {
      return { success: false, error: 'payment_already_redeemed' }
    }
    console.error('redeem_payment failed:', error.message)
    return { success: false, error: error.message }
  }
```

Adjust the exact return shape to match the function's existing signature — read the current `redeemPayment` and keep its return type, only adding the duplicate-detection branch.

- [ ] **Step 6: Apply the migration to the live database**

Preferred: `supabase db push` (see Task 3.1). Fallback: Supabase Dashboard SQL editor.

Verify the index exists:

```bash
curl -s "$SUPABASE_URL/rest/v1/credit_transactions?select=id&reference_id=eq.0xnonexistent" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: `[]` with no error (the index does not break reads).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/010_payment_idempotency.sql src/lib/payments.ts test/payment-idempotency.test.mjs
git commit -m "fix(payments): enforce single redemption per transaction hash"
```

---

### Task 2.9: Apply filters inside the vector search, not after it

**Closes findings:** F17

**Files:**
- Modify: `src/app/api/memory/search/route.ts:46-73`
- Modify: `supabase/migrations/011_search_with_filters.sql` (new RPC)

**Interfaces:**
- Consumes: nothing.
- Produces: a new RPC `search_memories_filtered(p_tenant_id UUID, p_embedding extensions.vector(1024), p_limit INT, p_min_score FLOAT, p_tags TEXT[], p_importance_min INT, p_importance_max INT, p_date_from TIMESTAMPTZ, p_date_to TIMESTAMPTZ)` returns the same columns as `search_memories` plus `similarity`, applying every filter **before** the `LIMIT`. The filter-only path additionally supports `metadata` containment, matching the vector path.

- [ ] **Step 1: Write the failing test**

Create `test/search-filters.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — neither the migration nor the route change exists.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/011_search_with_filters.sql`:

```sql
-- Vector search that applies filters BEFORE the LIMIT, so filtered-out rows
-- do not consume result slots.
CREATE OR REPLACE FUNCTION search_memories_filtered(
  p_tenant_id UUID,
  p_embedding extensions.vector(1024),
  p_limit INT DEFAULT 10,
  p_min_score FLOAT DEFAULT 0.0,
  p_tags TEXT[] DEFAULT NULL,
  p_importance_min INT DEFAULT NULL,
  p_importance_max INT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID, content TEXT, metadata JSONB, tags TEXT[], importance INT,
  expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id, m.content, m.metadata, m.tags, m.importance,
    m.expires_at, m.created_at, m.updated_at,
    1 - (m.embedding <=> p_embedding) AS similarity
  FROM memories m
  WHERE m.tenant_id = p_tenant_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_embedding) >= p_min_score
    AND (p_tags IS NULL OR m.tags && p_tags)
    AND (p_importance_min IS NULL OR m.importance >= p_importance_min)
    AND (p_importance_max IS NULL OR m.importance <= p_importance_max)
    AND (p_date_from IS NULL OR m.created_at >= p_date_from)
    AND (p_date_to IS NULL OR m.created_at <= p_date_to)
  ORDER BY m.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;
```

- [ ] **Step 4: Run test to verify it passes (migration half)**

Run: `npm test`
Expected: FAIL — the route half is not yet done.

- [ ] **Step 5: Use the filtered RPC in the route**

In `src/app/api/memory/search/route.ts`, replace the vector-search block:

```ts
    if (body.query) {
      const queryEmbedding = body.embedding || await generateEmbedding(body.query)
      const f = body.filters || {}

      const { data, error } = await supabase.rpc('search_memories_filtered', {
        p_tenant_id: auth.tenantId,
        p_embedding: queryEmbedding,
        p_limit: limit,
        p_min_score: minScore,
        p_tags: f.tags?.length ? f.tags : null,
        p_importance_min: f.importance_min ?? null,
        p_importance_max: f.importance_max ?? null,
        p_date_from: f.date_from ?? null,
        p_date_to: f.date_to ?? null,
      })

      if (error) {
        return respondError('internal_error', 'Search failed: ' + error.message, 500)
      }

      let results = (data || []).map((r: any) => ({ ...r, score: r.similarity }))

      // metadata is not expressible in the RPC; apply it here.
      if (f.metadata) {
        results = applyFilters(results, { metadata: f.metadata })
      }

      logUsage(auth, 'POST /api/memory/search')
      const nb1 = await deductCredits(auth.tenantId, 'POST', '/api/memory/search')
      return respond(results, 200, { total: results.length, query: body.query, credits_remaining: nb1 ?? undefined })
    }
```

The `applyFilters` helper stays, but is now only used for the `metadata` subset.

- [ ] **Step 6: Add metadata support to the filter-only path**

In the filter-only branch of the same file, after the existing filter conditions, add:

```ts
      if (body.filters.metadata) {
        for (const [key, value] of Object.entries(body.filters.metadata)) {
          query = query.contains('metadata', { [key]: value })
        }
      }
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Apply the migration and verify**

Apply via `supabase db push` or the dashboard. Then verify the RPC accepts the new parameter set:

```bash
curl -s -X POST "$SUPABASE_URL/rest/v1/rpc/search_memories_filtered" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"p_tenant_id":"00000000-0000-0000-0000-000000000000","p_embedding":[0.1],"p_limit":1,"p_min_score":0.0,"p_tags":null,"p_importance_min":null,"p_importance_max":null,"p_date_from":null,"p_date_to":null}'
```

Expected: a 400 mentioning vector dimensions (the 1-element probe embedding is intentional — it proves the function was found and dispatched, not that it succeeded). A `PGRST202` "function not found" would mean the migration was not applied.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/011_search_with_filters.sql src/app/api/memory/search/route.ts test/search-filters.test.mjs
git commit -m "fix(search): apply filters before the vector LIMIT"
```

### Task 2.10: Bound the auth cache

**Closes findings:** F22

**Files:**
- Modify: `src/lib/auth.ts:10-11, 27-30, 52-56`

**Interfaces:**
- Consumes: nothing.
- Produces: `authCache` is capped at `AUTH_CACHE_MAX_ENTRIES` (1000). When the cache is full, the oldest entry is evicted before a new one is inserted. The 60-second TTL behavior is unchanged. The unbounded-growth leak is closed.

- [ ] **Step 1: Write the failing test**

Create `test/auth-cache.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'src', 'lib', 'auth.ts'), 'utf8')

test('the auth cache is bounded', () => {
  assert.match(src, /AUTH_CACHE_MAX_ENTRIES/)
  assert.match(src, /authCache\.size\s*>=\s*AUTH_CACHE_MAX_ENTRIES/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the cache is unbounded.

- [ ] **Step 3: Bound the cache**

In `src/lib/auth.ts`, add the constant and the eviction:

```ts
/** Max cached API keys. Evicted oldest-first so the map cannot grow without bound. */
const AUTH_CACHE_MAX_ENTRIES = 1000
```

Replace the cache-write block:

```ts
  // Cache it, evicting the oldest entry when full
  if (authCache.size >= AUTH_CACHE_MAX_ENTRIES) {
    const oldestKey = authCache.keys().next().value
    if (oldestKey !== undefined) authCache.delete(oldestKey)
  }
  authCache.set(rawKey, { ...result, cachedAt: Date.now() })
```

`Map` preserves insertion order, so `keys().next().value` is the oldest entry.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts test/auth-cache.test.mjs
git commit -m "fix(auth): bound the API key cache"
```

### Task 2.11: Fix the credits endpoint's advertised contract

**Closes findings:** F15, F23

**Files:**
- Modify: `src/app/api/credits/route.ts:24-38` (the `pricing` and `top_up` payloads)
- Modify: `src/app/api/credits/route.ts:115-119` (the `total_purchased` corruption)

**Interfaces:**
- Consumes: `PRICING` from `src/lib/pricing.ts` (Task 1.3).
- Produces:
  - `GET /api/credits` returns `data.pricing` derived from the real `PRICING` table rather than a hand-copied subset, so the two can never drift.
  - `data.top_up.url` is `/api/credits` (the real endpoint), not `/api/credits/top-up` (a 404).
  - A top-up no longer overwrites `total_purchased` with the current balance.

- [ ] **Step 1: Write the failing test**

Create `test/credits-contract.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'src', 'app', 'api', 'credits', 'route.ts'), 'utf8')

test('the top_up url points at the endpoint that exists', () => {
  assert.doesNotMatch(src, /'\/api\/credits\/top-up'/)
})

test('the pricing payload is derived from the pricing table', () => {
  assert.match(src, /PRICING/)
})

test('the top-up path does not overwrite total_purchased with the balance', () => {
  assert.doesNotMatch(src, /total_purchased:\s*currentBalance/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — all three assertions fail.

- [ ] **Step 3: Derive the pricing payload from the real table**

In `src/app/api/credits/route.ts`, add the import:

```ts
import { PRICING } from '@/lib/pricing'
```

Replace the hardcoded `pricing` object in the GET handler with:

```ts
      pricing: {
        ...PRICING,
        'state_operations': 'free',
        'webhooks': 'free',
      },
```

- [ ] **Step 4: Fix the top-up URL**

Replace:

```ts
      top_up: {
        via: X402_CONFIG,
        url: '/api/credits/top-up',
      },
```

with:

```ts
      top_up: {
        via: X402_CONFIG,
        url: '/api/credits',
        method: 'POST',
        body: { payment_tx: '<base tx hash>', amount_usdc: '<amount>' },
      },
```

- [ ] **Step 5: Stop corrupting `total_purchased`**

The top-up path upserts `credit_balances` with `total_purchased: currentBalance`, which overwrites the real lifetime-purchased total with the current balance. Since the `payment_tx` branch returns earlier (before this code), the only path reaching it is `test_top_up` — but the bug is still wrong. Fix it by not sending `total_purchased` in the upsert at all, so the existing value is preserved:

```ts
    // Add credits. Only touch `balance` — `total_purchased` and
    // `total_consumed` must reflect lifetime history, not the current balance.
    await supabase.from('credit_balances').upsert({
      tenant_id: auth.tenantId,
      balance: newBalance,
    }, { onConflict: 'tenant_id' })
```

Note: `upsert` on a conflict target that omits a column leaves that column unchanged, so `total_purchased` and `total_consumed` are preserved.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify against the live API**

Deploy, then:

```bash
curl -s https://neura-blond.vercel.app/api/credits -H "Authorization: Bearer $NEURA_KEY" | python3 -m json.tool
```

Expected: `data.top_up.url` is `/api/credits`; `data.pricing` contains `POST /api/memory/batch`.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/credits/route.ts test/credits-contract.test.mjs
git commit -m "fix(credits): derive pricing from the pricing table, fix top_up url, stop corrupting total_purchased"
```

---

## Phase C — Make the live database reproducible

### Task 3.1: Fix the Supabase project link and document the migration path

**Closes findings:** F32 (documented, not changed)

**Files:**
- Modify: `supabase/config.toml` (add the missing `[db.seed]` path handling and the project id)
- Create: `docs/migrations.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `supabase link --project-ref hykistvnlfhiywuifcak` succeeds for an operator with the right org, and `docs/migrations.md` documents the two supported ways to apply migrations (CLI push, or dashboard SQL editor) plus the current live-vs-migration drift list.

- [ ] **Step 1: Record the current drift as a checklist**

Create `docs/migrations.md`:

```markdown
# Neura Database Migrations

## Applying migrations

Two supported paths:

1. **Supabase CLI (preferred)** — `supabase link --project-ref hykistvnlfhiywuifcak`
   then `supabase db push`. Requires an access token whose org owns the project.
2. **Dashboard SQL editor** — paste the contents of each migration file in
   numeric order into Supabase Dashboard → SQL Editor and run them.

## Live-vs-migration drift (as of 2026-10-20)

The live database was provisioned out-of-band, so it contains objects that no
migration file creates. Every item below is reconciled by a migration added in
this plan:

| Object | Live | Migration | Reconciled by |
|---|---|---|---|
| RLS enabled on all 10 tables | yes | no | `012_enable_rls.sql` |
| `webhook_deliveries.retry_count` | yes | no | `012_enable_rls.sql` |
| `trg_create_credit_balance` on `api_keys` | yes | yes (003) | — |
| `on_auth_user_created` trigger | no | yes (006) | `012_enable_rls.sql` (drops) |
| `on_user_created` trigger | no | yes (006/007) | `012_enable_rls.sql` (drops) |
| `deduct_credits` grants 1000 when no row | yes | yes (004) | `009_harden_credit_balances.sql` |

## Invariants

- Embeddings are `vector(1024)`.
- `search_memories` and `search_memories_filtered` take `vector(1024)`.
- `credit_transactions.reference_id` is unique for `transaction_type = 'purchase'`.
- Every migration is idempotent and may be re-run.
```

- [ ] **Step 2: Attempt the link and record the outcome**

```bash
supabase link --project-ref hykistvnlfhiywuifcak
```

If it fails with `LegacyLinkProjectStatusError` / "does not have the necessary privileges", the authenticated Supabase account does not own the project. The operator must either re-authenticate with the owning account (`supabase logout && supabase login`) or use the dashboard path. Record which path was used in `docs/migrations.md` under "Applying migrations" — mark the CLI path as "preferred" and note the account requirement.

- [ ] **Step 3: Verify `supabase/config.toml` matches the migrations directory**

Read `supabase/config.toml` and confirm `[db.migrations]` has `enabled = true` and `schema_paths = ["public"]`. The file also declares `[db.seed] sql_paths = ["./seed.sql"]` but **no `supabase/seed.sql` exists**. Either create an empty `supabase/seed.sql` (so `supabase db reset` does not fail) or remove the `sql_paths` line. Creating an empty file is safer for `db reset`. Create `supabase/seed.sql` containing only a comment:

```sql
-- Intentionally empty. Seed data for local development goes here.
-- Never put production data in this file.
```

- [ ] **Step 4: Commit**

```bash
git add docs/migrations.md supabase/seed.sql
git commit -m "docs(db): document migration paths and record live-schema drift"
```

---

### Task 3.2: Add the missing schema objects as a migration

**Closes findings:** F7, F8, F9

**Files:**
- Create: `supabase/migrations/012_enable_rls.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: after applying this migration to a freshly-reset database, the schema is behaviorally identical to the live database:
  - RLS is enabled on `api_keys`, `memories`, `state_store`, `usage_logs`, `webhooks`, `webhook_deliveries`, `shared_memories`, `credit_balances`, `credit_transactions`, `users`.
  - No RLS policy grants `anon` or `authenticated` any access to those tables (the app uses `service_role`, which bypasses RLS).
  - `webhook_deliveries.retry_count INT NOT NULL DEFAULT 0` exists.
  - The `on_auth_user_created` and `on_user_created` triggers do **not** exist (signup provisioning is app-layer in `/api/auth/me`).
  - `trg_create_credit_balance` on `api_keys` **does** exist.

- [ ] **Step 1: Write the failing test**

Create `test/schema-reconciliation.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(import.meta.dirname, '..')

test('a migration enables RLS on every Neura table', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  const tables = [
    'api_keys', 'memories', 'state_store', 'usage_logs', 'webhooks',
    'webhook_deliveries', 'shared_memories', 'credit_balances',
    'credit_transactions', 'users',
  ]
  for (const table of tables) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY`),
      `RLS not enabled for ${table}`
    )
  }
})

test('a migration adds the missing retry_count column', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  assert.match(sql, /ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0/)
})

test('a migration drops the crashing signup triggers', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  assert.match(sql, /DROP TRIGGER IF EXISTS on_auth_user_created ON auth\.users/)
  assert.match(sql, /DROP TRIGGER IF EXISTS on_user_created ON public\.users/)
})

test('a migration creates no permissive anon policy', () => {
  const sql = readFileSync(join(root, 'supabase', 'migrations', '012_enable_rls.sql'), 'utf8')
  assert.doesNotMatch(sql, /TO\s+anon/)
  assert.doesNotMatch(sql, /TO\s+authenticated/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — the migration file does not exist.

- [ ] **Step 3: Create the migration**

Create `supabase/migrations/012_enable_rls.sql`:

```sql
-- Reconcile the migration history with the live database.
--
-- The live database was provisioned out-of-band: it has RLS on every table
-- and a webhook_deliveries.retry_count column that no migration file creates,
-- and it is missing the two signup triggers that crash provisioning.
-- This migration makes a freshly-reset database behave like the live one.

-- ============================================================
-- Row Level Security — deny anon/authenticated, allow service_role
-- ============================================================
-- The application connects with the service_role key, which bypasses RLS.
-- No policy is created for anon or authenticated, so the public anon key
-- cannot read or write any Neura table.

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- webhook_deliveries.retry_count — written by src/lib/webhooks.ts
-- ============================================================
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- ============================================================
-- Signup provisioning is app-layer (/api/auth/me), not trigger-layer.
-- These triggers crashed on signup and were removed from the live database.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON public.users;

-- The functions are left in place (harmless) so this migration is
-- reversible; drop them in a later migration if confirmed unused.
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Apply the migration to the live database**

It must be idempotent against the live database (RLS is already on, the column already exists, the triggers are already gone). Apply via `supabase db push` or the dashboard.

Verify RLS is still enforced after applying:

```bash
curl -s "$SUPABASE_URL/rest/v1/memories?select=id" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Authorization: Bearer $SUPABASE_ANON_KEY"
```

Expected: `[]` (RLS blocks the read).

- [ ] **Step 6: Verify a fresh reset reproduces the live schema**

On a scratch database (not production), run `supabase db reset` and then compare the resulting schema to the live one:

```bash
supabase db reset --db-url "$SCRATCH_DB_URL"
```

Then dump both schemas and diff the object lists:

```bash
for db in "$SCRATCH_DB_URL" "$PRODUCTION_DB_URL"; do
  psql "$db" -Atc "select table_name, column_name, data_type from information_schema.columns where table_schema='public' order by 1,2"
done | sort | uniq -c | sort -n
```

Expected: the column lists match exactly for the 10 Neura tables.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/012_enable_rls.sql test/schema-reconciliation.test.mjs
git commit -m "fix(db): reconcile migrations with the live schema (RLS, retry_count, signup triggers)"
```

---

### Task 3.3: Renumber the duplicate `007` migration

**Closes findings:** F35

**Files:**
- Rename: `supabase/migrations/007_embeddings_dim_1024.sql` → `supabase/migrations/007_embeddings_dim_1024.sql` (unchanged)
- Rename: `supabase/migrations/007_fix_signup_trigger.sql` → `supabase/migrations/008_fix_signup_trigger.sql`
- Modify: `supabase/migrations/008_fix_signup_trigger.sql` (add a note that the trigger is dropped by 012)

**Interfaces:**
- Consumes: nothing.
- Produces: every migration file has a unique version prefix, so `supabase db push` and `supabase db reset` stop erroring with "duplicate migration version". The numeric order is: 001, 002, 003, 004, 005, 006, 007, 008, 009, 010, 011, 012.

- [ ] **Step 1: Confirm the duplicate is real**

```bash
ls supabase/migrations/ | cut -c1-3 | sort | uniq -d
```

Expected: `007`.

- [ ] **Step 2: Rename the file with git**

```bash
git mv supabase/migrations/007_fix_signup_trigger.sql supabase/migrations/008_fix_signup_trigger.sql
```

- [ ] **Step 3: Update the file's header comment**

In `supabase/migrations/008_fix_signup_trigger.sql`, replace the leading comment block with:

```sql
-- Fix: signup trigger missing balance_after in credit_transactions INSERT
-- The credit_transactions table requires balance_after (NOT NULL),
-- but create_user_api_key() was inserting without it, causing signup to crash.
--
-- Renumbered from 007 to 008: two files shared the 007 prefix, which made
-- `supabase db push` and `supabase db reset` fail with "duplicate migration
-- version". This file sorts after 007_embeddings_dim_1024.sql.
--
-- NOTE: the `on_user_created` trigger this function backs is dropped in
-- 012_enable_rls.sql — signup provisioning is app-layer in /api/auth/me.
```

- [ ] **Step 4: Verify the versions are unique**

```bash
ls supabase/migrations/ | cut -c1-3 | sort | uniq -d
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "fix(db): renumber duplicate 007 migration to 008"
```

---

## Phase D — Documentation, UI truth, and the test harness

### Task 4.1: Rewrite `AGENTS.md` to describe the actual product

**Closes findings:** F27

**Files:**
- Modify: `AGENTS.md` (full rewrite)
- Modify: `CLAUDE.md` (keep the `@AGENTS.md` pointer, but fix the file it points to)

**Interfaces:**
- Consumes: nothing.
- Produces: `AGENTS.md` accurately describes Neura as an agent memory/state/webhook/credits API. It states the real SDK version (`0.3.0`), the real cron count (3), the real embedding provider (Voyage AI → Gemini), and names the actual files. It no longer mentions Dominion, PICKR, or a crypto dashboard.

- [ ] **Step 1: Write the failing test**

Create `test/agents-md.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'AGENTS.md'), 'utf8')

test('AGENTS.md does not describe products that are not in this repo', () => {
  for (const wrong of ['Dominion', 'PICKR', 'crypto intelligence', 'Crypto Price API']) {
    assert.doesNotMatch(src, new RegExp(wrong, 'i'), `AGENTS.md still mentions ${wrong}`)
  }
})

test('AGENTS.md states the real SDK version and cron count', () => {
  assert.match(src, /neura-api\S*\s*0\.3\.0/)
  assert.match(src, /3\s+crons|three\s+crons/i)
})

test('AGENTS.md names the real embedding provider', () => {
  assert.match(src, /Voyage/i)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `AGENTS.md` still mentions Dominion and PICKR.

- [ ] **Step 3: Rewrite `AGENTS.md`**

Replace the entire file with:

````markdown
# AGENTS.md — Neura

> External brain for AI agents: persistent memory, state, webhooks, and
> self-payable credits, over HTTP.

**Vercel:** https://neura-blond.vercel.app
**Supabase project:** `hykistvnlfhiywuifcak`
**TS SDK:** `neura-api@0.3.0` (npm) · **Python SDK:** `neura-api-python@0.3.0` (PyPI)

## What this is

A headless HTTP API that agents call to persist state between runs:

| Primitive | Storage | API |
|---|---|---|
| Memory | `memories` (pgvector `vector(1024)`) | `POST/GET/PATCH/DELETE /api/memory` |
| State | `state_store` (JSONB) | `POST/GET/DELETE /api/state` |
| Webhooks | `webhooks` + `webhook_deliveries` | `/api/webhooks` |
| Credits | `credit_balances` + `credit_transactions` | `/api/credits` |

The web UI at `/` is a marketing page. `/dashboard` is a management console.
The product surface is the API.

## Tech Stack

- TypeScript / Next.js 16.2.6 (App Router), React 19.2.4
- Supabase (PostgreSQL 17, pgvector in the `extensions` schema)
- Voyage AI embeddings, 1024 dims, with Gemini as fallback
- Vercel (hosting + 3 crons)
- `node:test` for unit tests; `scripts/e2e-test.sh` for live end-to-end

## Key Files

- `src/app/api/**` — 24 route files, 38 HTTP handlers
- `src/lib/credits.ts` — pricing, balances, x402 payment config
- `src/lib/pricing.ts` — the pricing table and cost resolution (pure, unit-tested)
- `src/lib/webhooks.ts` — delivery, HMAC signing, retry with backoff
- `src/lib/embeddings.ts` — Voyage → Gemini embedding pipeline
- `src/lib/payments.ts` — Base USDC verification and redemption
- `src/lib/auth.ts` — API key → tenant resolution (SHA-256 hash lookup)
- `supabase/migrations/` — schema, in numeric order; see `docs/migrations.md`
- `sdk/typescript/`, `sdk/python/` — published SDKs
- `docs/openapi.yaml` — served at `/openapi.yaml`

## Commands

```bash
npm run dev        # local dev
npm run build      # production build
npm test           # unit tests (node:test)
npm run ci         # lint + typecheck + test + build
npm run lint
npm run typecheck
vercel deploy --prod
```

## Auth model

Two separate mechanisms:

1. **API key** — `sk-<64 hex>`, SHA-256 hashed in `api_keys.key_hash`.
   Sent as `Authorization: Bearer sk-...`. Used by every agent-facing endpoint.
2. **Supabase Auth JWT** — used only by `/api/auth/me` and `/api/auth/create-key`.
   On first call, `/api/auth/me` provisions the `users` row, an API key, and
   1000 free credits, and returns `raw_key` once.

## Credits

`src/lib/pricing.ts` is the source of truth. Batch create costs **1 credit
per memory**. When the balance is insufficient the API returns HTTP 402 with
an `error.x402` block (chain, token, amount, recipient, credits) so an agent
can pay USDC on Base and retry.

## Webhooks

7 event types: `memory.created`, `memory.updated`, `memory.deleted`,
`memory.expiring`, `memory.shared`, `state.changed`, `credits.low`.
Deliveries are HMAC-SHA256 signed (`X-Neura-Signature`), logged in
`webhook_deliveries`, and retried with backoff 30s → 2m → 10m → 1h → 6h.

## Crons

3 crons in `vercel.json`:
- `0 0 * * *` → `GET /api/payments/poll`
- `0 6 * * *` → `GET /api/webhooks/retry-cron`
- `0 12 * * *` → `GET /api/memory/cleanup`

## Conventions

- Every error response is `{error: {code, message, action}}`; every success is `{data, meta?}`.
- Migrations are idempotent and applied in numeric order.
- Never commit credentials. Tests read them from the environment.
- Database access uses the `service_role` key, which bypasses RLS.
````

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md CLAUDE.md test/agents-md.test.mjs
git commit -m "docs: rewrite AGENTS.md to describe Neura accurately"
```

---

### Task 4.2: Correct `summary.md`

**Closes findings:** F27 (summary.md), F31 (claims only, no deletion)

**Files:**
- Modify: `summary.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `summary.md` reports the real state: correct date, correct HEAD, correct migration count and file list, correct SDK versions, correct route count, and no claims about removed triggers or Vercel KV.

- [ ] **Step 1: Write the failing test**

Create `test/summary-md.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'summary.md'), 'utf8')

test('summary.md does not claim Vercel KV rate limiting', () => {
  assert.doesNotMatch(src, /Vercel KV/i)
})

test('summary.md does not claim the signup triggers were removed without saying where', () => {
  // The triggers ARE removed — but by migration 012, so the summary should
  // not describe them as an out-of-band change.
  assert.doesNotMatch(src, /Triggers removed/)
})

test('summary.md lists the real migration count', () => {
  assert.match(src, /12 migrations/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL.

- [ ] **Step 3: Rewrite `summary.md`**

Replace the file with an accurate status document. Keep its existing shape (headings, tables) and update the values:

```markdown
# Neura — Project Status

**Last updated:** 2026-10-20
**Repo:** https://github.com/ghassan-gaidi/neura

## Git State

- **Remote:** origin → https://github.com/ghassan-gaidi/neura
- **Branch:** main
- **Working tree:** clean

## Deployment Health

- **Homepage** https://neura-blond.vercel.app/ — HTTP 200
- **API /api/credits** (unauthenticated) — HTTP 401 (auth gate working)
- **Vercel crons:** 3 daily jobs (payments poll 0:00, webhook retry 6:00, memory TTL 12:00)
- **Supabase:** `hykistvnlfhiywuifcak` — RLS enabled on all 10 tables
- **Project ID:** prj_t8HAisjHsSNKs4Xc5zGv02TuDsNp

## Stack

- **Next.js** 16.2.6 + React 19.2.4 (App Router)
- **Supabase** PostgreSQL 17 + pgvector (`extensions` schema)
- **Voyage AI** embeddings (1024 dim) with **Gemini** fallback
- **Vercel** hosting + 3 crons
- **node:test** unit tests + `scripts/e2e-test.sh` live e2e

## Database Schema

12 migrations, applied in numeric order. See `docs/migrations.md` for the
live-vs-migration drift reconciliation.

| # | File | Purpose |
|---|------|---------|
| 001 | `001_schema.sql` | Core: api_keys, memories, state_store, usage_logs, pgvector + HNSW |
| 002 | `002_webhooks_sharing.sql` | Webhooks, delivery log, shared memories |
| 003 | `003_credits_payments.sql` | Credit balances, transactions, balance trigger |
| 004 | `004_deduct_credits.sql` | RPC: `deduct_credits` |
| 005 | `005_redeem_payment.sql` | RPC: `redeem_payment` |
| 006 | `006_self_serve_signup.sql` | Users table, auth infrastructure |
| 007 | `007_embeddings_dim_1024.sql` | Migrate embeddings 1536 → 1024 dims |
| 008 | `008_fix_signup_trigger.sql` | Fix `create_user_api_key()` balance_after |
| 009 | `009_harden_credit_balances.sql` | Remove the 1000-credit self-grant |
| 010 | `010_payment_idempotency.sql` | Unique index: one redemption per tx hash |
| 011 | `011_search_with_filters.sql` | RPC: `search_memories_filtered` |
| 012 | `012_enable_rls.sql` | RLS on all tables; `retry_count`; drop signup triggers |

## API Surface

24 route files, 38 HTTP handlers.

**Memory:** `POST/GET /api/memory`, `POST/DELETE /api/memory/batch`,
`POST /api/memory/search`, `POST /api/memory/summarize`,
`PATCH/DELETE /api/memory/[id]`, `POST/GET/DELETE /api/memory/[id]/share`,
`GET /api/memory/cleanup`
**State:** `POST/GET /api/state`, `GET/DELETE /api/state/[key]`
**Webhooks:** `POST/GET /api/webhooks`, `GET/PATCH/DELETE /api/webhooks/[id]`,
`POST /api/webhooks/retry`, `GET /api/webhooks/retry-cron`
**Sharing:** `GET /api/shared-with-me`
**Payments:** `POST /api/payments/verify`, `GET /api/payments/poll`
**Credits:** `GET/POST /api/credits`
**Admin:** `GET/POST /api/admin/keys`, `DELETE /api/admin/keys/[id]`,
`GET /api/admin/transactions`, `GET /api/admin/usage`
**Auth:** `GET /api/auth/me`, `POST /api/auth/create-key`
**Internal:** `POST /api/migrate`

## Auth & Signup

- `/signup` → Supabase Auth → `GET /api/auth/me` provisions the `users` row,
  an API key, and 1000 free credits, and returns `raw_key` once.
- The DB-side signup triggers were removed by migration `012`; all provisioning
  is app-layer.

## Credits Pricing

Defined in `src/lib/pricing.ts`.

| Operation | Cost |
|---|---|
| Memory create | 1 credit |
| Batch create | 1 credit **per memory** |
| Memory search (`GET /api/memory?query=`) | 1 credit |
| Advanced search (`POST /api/memory/search`) | 2 credits |
| Memory summarize | 5 credits |
| Memory update | 1 credit |
| Memory delete | free |
| State operations | free |
| Webhook CRUD | free |

## Rate Limiting

100 requests / 60s per API key, tracked **in memory** per serverless instance.
Every response carries `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
`X-RateLimit-Reset`.

## Webhooks

7 event types, all emitted: `memory.created`, `memory.updated`,
`memory.deleted`, `memory.expiring`, `memory.shared`, `state.changed`,
`credits.low`. Deliveries are HMAC-SHA256 signed and retried with backoff
30s → 2m → 10m → 1h → 6h.

## SDKs

| Package | Registry | Version |
|---|---|---|
| `neura-api` | npm | 0.3.0 |
| `neura-api-python` | PyPI | 0.3.0 |
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add summary.md test/summary-md.test.mjs
git commit -m "docs: correct summary.md to match the real system state"
```

---

### Task 4.3: Correct the OpenAPI spec

**Closes findings:** F26, F28

**Files:**
- Modify: `docs/openapi.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: `docs/openapi.yaml` is version `0.3.0`, documents all 24 routes, uses the real field names, and describes the real embedding provider. It is served at `/openapi.yaml`.

- [ ] **Step 1: Write the failing test**

Create `test/openapi.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'docs', 'openapi.yaml'), 'utf8')

test('the spec version matches the SDK version', () => {
  assert.match(src, /version:\s*["']?0\.3\.0/)
})

test('the spec covers every route file', () => {
  const required = [
    '/api/memory:', '/api/memory/batch:', '/api/memory/search:',
    '/api/memory/summarize:', '/api/memory/{id}:', '/api/memory/{id}/share:',
    '/api/memory/cleanup:', '/api/shared-with-me:', '/api/state:',
    '/api/state/{key}:', '/api/webhooks:', '/api/webhooks/{id}:',
    '/api/webhooks/retry:', '/api/webhooks/retry-cron:', '/api/credits:',
    '/api/payments/verify:', '/api/payments/poll:', '/api/auth/me:',
    '/api/auth/create-key:', '/api/admin/keys:', '/api/admin/keys/{id}:',
    '/api/admin/transactions:', '/api/admin/usage:', '/api/migrate:',
  ]
  const missing = required.filter(p => !src.includes(p))
  assert.deepEqual(missing, [])
})

test('the spec does not claim OpenAI embeddings', () => {
  assert.doesNotMatch(src, /via OpenAI/i)
  assert.doesNotMatch(src, /openai/i)
})

test('the spec uses the real payment verification field', () => {
  assert.match(src, /payment_tx/)
  assert.doesNotMatch(src, /transaction_hash/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — version is `0.2.0`, several routes are missing, and "OpenAI" appears.

- [ ] **Step 3: Fix the version and the embedding description**

In `docs/openapi.yaml`:
- Change `version: "0.2.0"` to `version: "0.3.0"`.
- Replace every occurrence of "auto-embedding via OpenAI" / "automatic embedding via OpenAI" with "auto-embedding via Voyage AI (1024-dim), with Gemini fallback".
- In the `info.description`, replace the OpenAI reference with the Voyage/Gemini description.

- [ ] **Step 4: Fix the payment verification field**

In the `/api/payments/verify` block, change the request body schema:

```yaml
            schema:
              type: object
              required: [payment_tx]
              properties:
                payment_tx:
                  type: string
                  description: On-chain transaction hash of the USDC transfer.
                amount_usdc:
                  type: string
                  description: Expected amount in USDC. Optional.
```

- [ ] **Step 5: Add the missing routes**

Append path blocks for every route not yet present, using the same schema components the file already defines. The blocks to add:

- `/api/credits` — add a `post` operation (the `get` already exists). Request body: `{payment_tx?, amount_usdc?, test_top_up?}`; responses `200`, `400`, `401`, `402`, `429`.
- `/api/auth/create-key` — `post`. Request body `{label}`; response `201` with the new key's `id`, `label`, and `raw_key`.
- `/api/memory/cleanup` — `get`. Cron-gated; responses `200`, `403`.
- `/api/webhooks/retry-cron` — `get`. Cron-gated; responses `200`, `403`.
- `/api/payments/poll` — `get`. Cron-gated; responses `200`, `403`.
- `/api/memory/{id}/share` — add `get` and `delete` operations (only `post` exists). `delete` takes a `target` query parameter.
- `/api/migrate` — `post`. Request header `x-migration-key`; request body `{sql}`; responses `200`, `400`, `401`, `503`.

Use `security: []` for the three cron routes and for `/api/migrate` (they authenticate via headers, not a bearer token).

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify the spec is valid YAML and serves correctly**

```bash
python3 -c "import yaml,sys; d=yaml.safe_load(open('docs/openapi.yaml')); print('paths:', len(d['paths']), 'version:', d['info']['version'])"
```

Expected: `paths: 24` (or more) and `version: 0.3.0`.

Then after deploying: `curl -s https://neura-blond.vercel.app/openapi.yaml | head -20` — Expected: the YAML with `version: "0.3.0"`.

- [ ] **Step 8: Commit**

```bash
git add docs/openapi.yaml test/openapi.test.mjs
git commit -m "docs(openapi): bump to 0.3.0 and cover every route"
```

---

### Task 4.4: Correct the docs page and the landing page claims

**Closes findings:** F24, F26 (docs page + landing page)

**Files:**
- Modify: `src/app/docs/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx` (SEO keyword "OpenAI embeddings")
- Modify: `src/components/seo/APIReferenceSchema.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: every user-visible claim matches reality. Specifically: the endpoint count is real, the embedding provider is Voyage AI with Gemini fallback, the rate-limit headers exist, the memory limit is enforced, all 7 webhook events exist, and the PyPI install command is `pip install neura-api-python`.

- [ ] **Step 1: Write the failing test**

Create `test/claims.test.mjs`:

```js
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
})

test('the docs page uses the correct PyPI package name', () => {
  const src = read('src/app/docs/page.tsx')
  assert.doesNotMatch(src, /pip install neura-api\b(?!-python)/)
  assert.match(src, /pip install neura-api-python/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — "OpenAI" appears in four files and the landing page says 28.

- [ ] **Step 3: Fix the docs page**

In `src/app/docs/page.tsx`:
- Line 9: replace `desc: 'Store a fact with auto-embedding via OpenAI. ...'` with `desc: 'Store a fact with auto-embedding via Voyage AI (1024-dim). ...'`.
- Line 275: replace `pip install neura-api` with `pip install neura-api-python`.
- Expand the `endpoints` array to cover all 24 route files. Each entry keeps the existing shape (`{ method, path, desc }`). Add the missing ones:

```ts
  { method: 'POST', path: '/api/memory/batch', desc: 'Store up to 25 memories. Costs 1 credit per memory.' },
  { method: 'DELETE', path: '/api/memory/batch', desc: 'Delete up to 100 memories by ID. Free.' },
  { method: 'POST', path: '/api/memory/summarize', desc: 'Summarize memories. Costs 5 credits. Provide memory_ids or a query.' },
  { method: 'POST', path: '/api/memory/:id/share', desc: 'Share a memory with another tenant. Body: { target_tenant_id, permission }.' },
  { method: 'GET', path: '/api/memory/:id/share', desc: 'List who a memory is shared with.' },
  { method: 'DELETE', path: '/api/memory/:id/share', desc: 'Remove a share. Query: ?target=<tenant_id>.' },
  { method: 'GET', path: '/api/memory/cleanup', desc: 'Cron: delete expired memories and notify memory.expiring.' },
  { method: 'POST', path: '/api/webhooks', desc: 'Register a webhook. Body: { url, events, secret? }.' },
  { method: 'GET', path: '/api/webhooks', desc: 'List registered webhooks.' },
  { method: 'GET', path: '/api/webhooks/:id', desc: 'Get a webhook. The HMAC secret is never returned.' },
  { method: 'PATCH', path: '/api/webhooks/:id', desc: 'Update a webhook URL, events, or secret.' },
  { method: 'DELETE', path: '/api/webhooks/:id', desc: 'Delete a webhook.' },
  { method: 'POST', path: '/api/webhooks/retry', desc: 'Retry this tenant’s failed deliveries.' },
  { method: 'GET', path: '/api/webhooks/retry-cron', desc: 'Cron: retry all failed deliveries.' },
  { method: 'GET', path: '/api/shared-with-me', desc: 'List memories shared with this tenant.' },
  { method: 'POST', path: '/api/credits', desc: 'Top up credits. Body: { payment_tx, amount_usdc? }.' },
  { method: 'POST', path: '/api/payments/verify', desc: 'Verify a USDC transfer on Base and redeem credits.' },
  { method: 'GET', path: '/api/payments/poll', desc: 'Cron: scan Base for uncredited USDC transfers.' },
  { method: 'GET', path: '/api/auth/me', desc: 'Get the current profile, API key, and credit balance. Supabase JWT required.' },
  { method: 'POST', path: '/api/auth/create-key', desc: 'Create an additional API key. Supabase JWT required.' },
  { method: 'GET', path: '/api/admin/keys', desc: 'List API keys for this tenant.' },
  { method: 'POST', path: '/api/admin/keys', desc: 'Create an API key. The raw key is returned once.' },
  { method: 'DELETE', path: '/api/admin/keys/:id', desc: 'Revoke an API key.' },
  { method: 'GET', path: '/api/admin/transactions', desc: 'List credit transactions.' },
  { method: 'GET', path: '/api/admin/usage', desc: 'Usage and credit spend by endpoint and day.' },
```

- Also fix the rate-limit section (line 237-239): the headers are now always present, so the text should say "Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `X-RateLimit-Reset`." rather than describing them as optional.

Also fix the idempotency section (line 247): change "POST and PATCH endpoints accept an `Idempotency-Key` header" to "All memory and state write endpoints accept an `Idempotency-Key` header. A replay returns the original response with `X-Idempotency-Replayed: true` and is not charged twice."

- [ ] **Step 4: Fix the landing page**

In `src/app/page.tsx`:
- Line 107: change `{ n: '28', label: 'API Endpoints' }` to `{ n: '38', label: 'API Endpoints' }` — 38 is the number of HTTP handlers across 24 route files. (The label says "API Endpoints"; if the number of *paths* is preferred, use `'24'` and change the label to `'API Routes'`. Use `n: '24', label: 'API Routes'` — a route file is a path, a handler is a method on it. The doc page lists 24 paths. Choose `'24'` with label `'API Routes'` and update the adjacent stats consistently.)
- Line 242: the "100 memories max" claim is now true (Task 2.5) — keep it.
- Line 34: the "7 event types" claim is now true (Task 2.6) — keep it.

- [ ] **Step 5: Fix the SEO metadata**

In `src/app/layout.tsx`, replace the `"OpenAI embeddings"` keyword with `"Voyage AI embeddings"`.

In `src/components/seo/APIReferenceSchema.tsx`, replace "auto-embedding via OpenAI" with "auto-embedding via Voyage AI with Gemini fallback".

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Verify the pages render**

```bash
npm run build && npm start &
sleep 5
curl -s http://localhost:3000/docs | grep -c "OpenAI"
curl -s http://localhost:3000/ | grep -o "API Routes" | head -1
```

Expected: the first command prints `0`; the second prints `API Routes`.

- [ ] **Step 8: Commit**

```bash
git add src/app/docs/page.tsx src/app/page.tsx src/app/layout.tsx src/components/seo/APIReferenceSchema.tsx test/claims.test.mjs
git commit -m "docs(ui): align landing page, docs page, and SEO metadata with reality"
```

---

### Task 4.5: Fix the README

**Closes findings:** F26 (README claims)

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nothing.
- Produces: `README.md` states the real endpoint count, the real batch pricing, the real PyPI package name, the real embedding provider, and the real rate-limit behavior. It drops the "Vercel KV" claim.

- [ ] **Step 1: Write the failing test**

Create `test/readme.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(join(import.meta.dirname, '..', 'README.md'), 'utf8')

test('the README does not claim Vercel KV rate limiting', () => {
  assert.doesNotMatch(src, /Vercel KV/i)
})

test('the README states the real batch pricing', () => {
  assert.match(src, /Batch create \(per memory\)\s*\|\s*1 credit/i)
})

test('the README uses the correct PyPI package name', () => {
  assert.match(src, /pip install neura-api-python/)
})

test('the README does not claim a stale endpoint count', () => {
  assert.doesNotMatch(src, /\b28 API Endpoints\b/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — "Vercel KV" and "28 API Endpoints" are present.

- [ ] **Step 3: Fix the README**

In `README.md`:
- Remove the "Vercel KV" mention. Replace the rate-limiting line with: "**Rate limiting:** 100 req/min per API key (in-memory, per instance). Every response returns `X-RateLimit-*` headers."
- Change the endpoint count from "28 API Endpoints" to "38 API endpoints across 24 routes".
- Keep the "Batch create (per memory) | 1 credit" row (it is now true).
- Ensure the PyPI install line reads `pip install neura-api-python` (it already does at line 221 — check for any other occurrence).
- Replace any "OpenAI" embedding reference with "Voyage AI (1024-dim) with Gemini fallback".

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add README.md test/readme.test.mjs
git commit -m "docs(readme): correct pricing, rate limiting, endpoint count, and package name"
```

---

### Task 4.6: Repair the e2e script and make it clean up after itself

**Closes findings:** F30, F24

**Files:**
- Modify: `scripts/e2e-test.sh`

**Interfaces:**
- Consumes: nothing.
- Produces: `bash scripts/e2e-test.sh` runs all 12 sections against the live API, asserts real values (not exit codes), and deletes the test user and tenant it creates. It exits non-zero if any assertion fails.

- [ ] **Step 1: Fix the broken assertion helper**

Replace the `test_result` function. The current implementation compares a *value* against an *expected substring*; the broken calls pass `"$?"` (an exit code, `0` or `1`) as the actual value and `"true"` as the expected string — so they always fail. Replace it with:

```bash
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
```

Now every call site must pass the *value* it is checking. The five broken call sites are the ones that used `grep -q ... ; test_result ... "true" "$?"`. Rewrite them:

```bash
# Landing page has JSON-LD schemas
if curl -s "$BASE/" | grep -q "application/ld+json"; then
  test_result "Landing page has JSON-LD schemas" "true" "true"
else
  test_result "Landing page has JSON-LD schemas" "true" "false"
fi

# Sitemap references the canonical domain
if curl -s "$BASE/sitemap.xml" | grep -q "neura.sh"; then
  test_result "Sitemap references neura.sh" "true" "true"
else
  test_result "Sitemap references neura.sh" "true" "false"
fi

# OpenAPI spec is valid YAML
if curl -s "$BASE/openapi.yaml" | grep -q "openapi:"; then
  test_result "OpenAPI spec is valid YAML" "true" "true"
else
  test_result "OpenAPI spec is valid YAML" "true" "false"
fi

# Error responses use the standard envelope
if curl -s "$BASE/api/memory" -H "Authorization: Bearer bad-key" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'error' in d and 'code' in d['error'] and 'message' in d['error']" 2>/dev/null; then
  test_result "Error response has {error:{code,message}}" "true" "true"
else
  test_result "Error response has {error:{code,message}}" "true" "false"
fi

# State errors use the same envelope
if curl -s "$BASE/api/state/nonexistent" -H "Authorization: Bearer bad-key" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'error' in d" 2>/dev/null; then
  test_result "State error follows same format" "true" "true"
else
  test_result "State error follows same format" "true" "false"
fi
```

- [ ] **Step 2: Fix the `raw_key` extraction**

The API returns `{data: {raw_key, credits, ...}}`, but the script reads `raw_key` at the top level. Replace:

```bash
RAW_KEY=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('raw_key',''))" 2>/dev/null)
```
with
```bash
RAW_KEY=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('raw_key',''))" 2>/dev/null)
```

And the credits extraction:
```bash
CREDITS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('credits',0))" 2>/dev/null)
```
with
```bash
CREDITS=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('credits',0))" 2>/dev/null)
```

- [ ] **Step 3: Fix the state-create status expectation**

`POST /api/state` returns **201**, not 200. Change the assertion to expect `201`.

- [ ] **Step 4: Add a cleanup section**

At the end of the script, before the summary, delete the test user so the script stops polluting `auth.users`. Add the Supabase admin delete (the anon key cannot delete users):

```bash
# ─── CLEANUP ───────────────────────────────────────
echo "▸ Cleanup"
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
```

Also delete the tenant's rows via the service role key so `api_keys`, `memories`, `credit_balances`, and `usage_logs` do not accumulate:

```bash
if [ -n "$SUPABASE_SERVICE_ROLE_KEY" ] && [ -n "$TENANT_ID" ]; then
  for T in api_keys memories state_store usage_logs credit_transactions credit_balances webhooks webhook_deliveries shared_memories; do
    curl -s -X DELETE "$SUPABASE_URL/rest/v1/$T?tenant_id=eq.$TENANT_ID" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" > /dev/null
  done
fi
```

Capture `TENANT_ID` from the `/api/auth/me` response in Step 2:

```bash
TENANT_ID=$(echo "$BODY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('user',{}).get('id',''))" 2>/dev/null)
```

Note: the API response exposes `user.id` (the auth user id), not `tenant_id`. Add `tenant_id` to the `respond()` payload in `src/app/api/auth/me/route.ts` so the script can clean up the tenant:

```ts
      user: { id: user.id, email: user.email, tenant_id: tenantId, plan: 'free', created_at: new Date().toISOString() },
```

and in the second return path add `tenant_id: profile.tenant_id`.

- [ ] **Step 5: Add a webhook-delivery assertion**

The script currently registers a webhook but never verifies delivery. Add a section that registers a webhook, creates a memory, waits, and checks `webhook_deliveries`:

```bash
# ─── WEBHOOK DELIVERY ─────────────────────────────
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

  sleep 6

  if [ -n "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
    R=$(curl -s "$SUPABASE_URL/rest/v1/webhook_deliveries?select=event,status&order=attempted_at.desc&limit=1" \
      -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY")
    echo "$R" | grep -q '"delivered"'
    test_result "Webhook delivery logged as delivered" "true" "$([ $? -eq 0 ] && echo true || echo false)"
  else
    echo "  ⚠ Skipped (SUPABASE_SERVICE_ROLE_KEY not set)"
    SKIP=$((SKIP+1))
  fi
fi
```

- [ ] **Step 6: Run the script and confirm all sections execute**

```bash
bash scripts/e2e-test.sh
```

Expected: 12+ sections run (no "no API key" skips), `Failed: 0`.

- [ ] **Step 7: Commit**

```bash
git add scripts/e2e-test.sh src/app/api/auth/me/route.ts
git commit -m "fix(e2e): fix broken assertions, read raw_key from data, verify webhook delivery, clean up test users"
```

---

### Task 4.7: Fix the Python SDK's asyncio handling

**Closes findings:** F36

**Files:**
- Modify: `sdk/python/neura/client.py:80`

**Interfaces:**
- Consumes: nothing.
- Produces: the Python SDK's 402 auto-payment path does not call `asyncio.run()` inside a running event loop. When called from async code it raises a clear `NeuraHttpError` with `code: "async_context_unsupported"` instead of `RuntimeError`.

- [ ] **Step 1: Write the failing test**

Create `test/python-sdk-async.test.mjs`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = readFileSync(
  join(import.meta.dirname, '..', 'sdk', 'python', 'neura', 'client.py'),
  'utf8'
)

test('the Python SDK does not call asyncio.run unconditionally', () => {
  assert.doesNotMatch(src, /asyncio\.run\(/)
})

test('the Python SDK detects a running event loop', () => {
  assert.match(src, /get_running_loop/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `asyncio.run(` is present.

- [ ] **Step 3: Guard the event-loop call**

In `sdk/python/neura/client.py`, replace the `asyncio.run(handle_payment_required(...))` call with:

```python
            try:
                asyncio.get_running_loop()
            except RuntimeError:
                # No loop running in this thread — safe to drive the coroutine.
                tx_hash = asyncio.run(handle_payment_required(self.on_payment_required, x402))
            else:
                raise NeuraHttpError(
                    402,
                    {
                        "code": "async_context_unsupported",
                        "message": (
                            "Auto-payment requires a synchronous context. Call the "
                            "payment callback yourself and retry the request."
                        ),
                        "action": "handle_payment_manually",
                    },
                )
```

Adjust the surrounding code to match the actual signature of `handle_payment_required` — read the current call and preserve its argument list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Verify with the Python SDK**

```bash
cd sdk/python && python3 -m venv /tmp/neura-venv && /tmp/neura-venv/bin/pip install -e . --quiet
/tmp/neura-venv/bin/python -c "
import neura
c = neura.Neura(api_key='sk-test')
print('import ok, version', neura.__version__)
"
```

Expected: no import error.

- [ ] **Step 6: Commit**

```bash
git add sdk/python/neura/client.py test/python-sdk-async.test.mjs
git commit -m "fix(python-sdk): do not call asyncio.run inside a running event loop"
```

---

## Appendices

### A. Deployment order

Phase A (security) must ship first and be verified before anything else deploys. The recommended order:

1. **Task 1.1** (rotate the key) — do this first and alone. It invalidates the leaked key.
2. **Task 1.2** (CI) — the rest of the plan adds tests that CI must run.
3. **Task 1.3, 1.4, 1.5, 1.6, 1.7** (security) — these can land in any order.
4. **Tasks 3.1, 3.3** (migration plumbing) — before Task 3.2.
5. **Task 3.2** (RLS reconciliation) — requires the migration path from 3.1.
6. **Phase B** (API/SDK) — each task is independent.
7. **Phase D** (docs) — after Phase B, so the docs describe the fixed behavior.

Deploy to production after each phase, not only at the end. Every task's "verify against the live API" step assumes the change is deployed.

### B. Manual steps that cannot be scripted

| Task | Manual action | Where |
|---|---|---|
| 1.1 Step 7 | Reset the Supabase `service_role` key; update Vercel env vars; redeploy | Supabase Dashboard → API; Vercel → Settings → Env Vars |
| 1.2 Step 6 | Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` repo secrets | `gh secret set <NAME>` |
| 1.7 | Domain re-registration or an SDK release with a corrected default base URL (out of scope) | Registrar / npm + PyPI |
| 3.1 Step 2 | `supabase link` with an account that owns the project | `supabase login` |
| 3.2 Step 6 | Run `supabase db reset` against a **scratch** database and diff the schema | Operator workstation |

### C. Known issues this plan does NOT fix

- **F3 / the parked `neura.sh` domain.** Explicitly out of scope. The SDKs remain broken by default until the domain is re-registered or SDK `0.3.1` ships with a corrected default. The `baseUrl` option the SDKs already accept is the only workaround available today.
- **F32 / the shared Supabase project.** `crypto-empire` and PICKR share the database (8 `tg_*` tables plus a `projects` table). Nothing in this plan touches them, but the blast radius of any future destructive change is the whole project.
- **In-memory rate limiting and idempotency.** `src/lib/rate-limit.ts` and `src/lib/idempotency.ts` use per-instance `Map`s. On Vercel's multi-instance serverless, the effective global limit is higher than 100/min and idempotency keys do not survive a cold start. Moving to a shared store (KV/Redis) is a separate project.
- **`GET /api/payments/poll` does not credit anyone.** It reports `new_uncredited` transfers but has no sender→tenant mapping, so an unclaimed payment must be redeemed manually via `POST /api/credits` with the tx hash. Making poll auto-credit requires a payment-memo convention, which is a product decision.
- **`/api/migrate` is an arbitrary SQL executor.** It is protected by `NEURA_MIGRATE_KEY` and a blocklist, and is the only way to apply out-of-band SQL. It should be retired once `supabase db push` works reliably, but retiring it is out of scope here.
- **F29 / `hermes-health.yml`.** The workflow monitors an unrelated Hugging Face Space and a Telegram bot and fails every 30 minutes. The file is not removed (out of scope), but it is worth noting that it is not a Neura check and its failures are noise.
- **`importance` rounding (F19/F20).** `memories.importance` is `INT`, so a client sending `0.8` gets `1`. The fix is to document integers, not to change the column type — changing it would alter the `search_memories` return signature.
