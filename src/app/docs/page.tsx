import Link from 'next/link'
import { FAQSchema } from '@/components/seo/FAQSchema'

const endpoints = [
  {
    method: 'POST',
    path: '/api/memory',
    title: 'Store Memory',
    desc: 'Store a fact with auto-embedding via Voyage AI (1024-dim). The content is vectorized and indexed for semantic search.',
    body: `{
  "content": "User prefers dark mode in all apps",
  "tags": ["preference", "ui"],
  "importance": 8,
  "metadata": { "source": "conversation" }
}`,
    response: `{
  "data": {
    "id": "uuid",
    "content": "...",
    "tags": ["preference", "ui"],
    "importance": 8,
    "created_at": "2026-05-14T..."
  }
}`,
  },
  {
    method: 'GET',
    path: '/api/memory?query=...&limit=10',
    title: 'Search Memories',
    desc: 'Semantic search. Returns memories ranked by cosine similarity (0-1). Omitting query returns most recent.',
    body: null,
    response: `{
  "data": [
    {
      "id": "uuid",
      "content": "...",
      "score": 0.92,
      "tags": ["preference"],
      "created_at": "2026-05-14T..."
    }
  ],
  "meta": { "total": 5, "query": "..." }
}`,
  },
  {
    method: 'POST',
    path: '/api/memory/search',
    title: 'Advanced Search',
    desc: 'Filter by tags, importance, date range, and metadata. Give agents precision control.',
    body: `{
  "query": "user preferences",
  "filters": {
    "tags": ["preference"],
    "importance_min": 5,
    "date_from": "2026-01-01"
  },
  "limit": 20,
  "min_score": 0.5
}`,
    response: `{
  "data": [...],
  "meta": { "total": 12 }
}`,
  },
  {
    method: 'PATCH',
    path: '/api/memory/:id',
    title: 'Update Memory',
    desc: 'Update fields. Content changes auto-regenerate the embedding.',
    body: `{ "importance": 9 }`,
    response: `{ "data": { ... } }`,
  },
  {
    method: 'DELETE',
    path: '/api/memory/:id',
    title: 'Delete Memory',
    desc: 'Remove a memory permanently.',
    body: null,
    response: `{ "data": { "id": "uuid", "deleted": true } }`,
  },
  {
    method: 'POST',
    path: '/api/state',
    title: 'Set State',
    desc: 'Persistent key-value storage. Survives context loss. Use for goals, settings, flags.',
    body: `{
  "key": "current_goal",
  "value": { "task": "Build API", "priority": "high" }
}`,
    response: `{ "data": { "key": "current_goal", "value": {...}, "updated_at": "..." } }`,
  },
  {
    method: 'GET',
    path: '/api/state/:key',
    title: 'Get State',
    desc: 'Retrieve a single value by key. Returns 404 if key doesn\'t exist.',
    body: null,
    response: `{ "data": { "key": "current_goal", "value": {...} } }`,
  },
  {
    method: 'GET',
    path: '/api/state',
    title: 'List State',
    desc: 'Return all state entries for this agent.',
    body: null,
    response: `{ "data": [{ "key": "...", "value": ... }] }`,
  },
  {
    method: 'DELETE',
    path: '/api/state/:key',
    title: 'Delete State',
    desc: 'Remove a state entry.',
    body: null,
    response: `{ "data": { "key": "...", "deleted": true } }`,
  },
  { method: 'POST', path: '/api/memory/batch', title: 'Batch Memory Store', desc: 'Store up to 25 memories. Costs 1 credit per memory.', body: null, response: null },
  { method: 'DELETE', path: '/api/memory/batch', title: 'Batch Memory Delete', desc: 'Delete up to 100 memories by ID. Free.', body: null, response: null },
  { method: 'POST', path: '/api/memory/summarize', title: 'Summarize Memories', desc: 'Summarize memories. Costs 5 credits. Provide memory_ids or a query.', body: null, response: null },
  { method: 'POST', path: '/api/memory/:id/share', title: 'Share Memory', desc: 'Share a memory with another tenant. Body: { target_tenant_id, permission }.', body: null, response: null },
  { method: 'GET', path: '/api/memory/:id/share', title: 'List Memory Shares', desc: 'List who a memory is shared with.', body: null, response: null },
  { method: 'DELETE', path: '/api/memory/:id/share', title: 'Remove Memory Share', desc: 'Remove a share. Query: ?target=<tenant_id>.', body: null, response: null },
  { method: 'GET', path: '/api/memory/cleanup', title: 'Memory Cleanup', desc: 'Cron: delete expired memories and notify memory.expiring.', body: null, response: null },
  { method: 'POST', path: '/api/webhooks', title: 'Register Webhook', desc: 'Register a webhook. Body: { url, events, secret? }.', body: null, response: null },
  { method: 'GET', path: '/api/webhooks', title: 'List Webhooks', desc: 'List registered webhooks.', body: null, response: null },
  { method: 'GET', path: '/api/webhooks/:id', title: 'Get Webhook', desc: 'Get a webhook. The HMAC secret is never returned.', body: null, response: null },
  { method: 'PATCH', path: '/api/webhooks/:id', title: 'Update Webhook', desc: 'Update a webhook URL, events, or secret.', body: null, response: null },
  { method: 'DELETE', path: '/api/webhooks/:id', title: 'Delete Webhook', desc: 'Delete a webhook.', body: null, response: null },
  { method: 'POST', path: '/api/webhooks/retry', title: 'Retry Failed Deliveries', desc: 'Retry this tenant\'s failed deliveries.', body: null, response: null },
  { method: 'GET', path: '/api/webhooks/retry-cron', title: 'Retry All Deliveries', desc: 'Cron: retry all failed deliveries.', body: null, response: null },
  { method: 'GET', path: '/api/shared-with-me', title: 'Shared With Me', desc: 'List memories shared with this tenant.', body: null, response: null },
  { method: 'POST', path: '/api/credits', title: 'Top Up Credits', desc: 'Top up credits. Body: { payment_tx, amount_usdc? }.', body: null, response: null },
  { method: 'POST', path: '/api/payments/verify', title: 'Verify Payment', desc: 'Verify a USDC transfer on Base and redeem credits.', body: null, response: null },
  { method: 'GET', path: '/api/payments/poll', title: 'Poll Payments', desc: 'Cron: scan Base for uncredited USDC transfers.', body: null, response: null },
  { method: 'GET', path: '/api/auth/me', title: 'Get Profile', desc: 'Get the current profile, API key, and credit balance. Supabase JWT required.', body: null, response: null },
  { method: 'POST', path: '/api/auth/create-key', title: 'Create API Key', desc: 'Create an additional API key. Supabase JWT required.', body: null, response: null },
  { method: 'GET', path: '/api/admin/keys', title: 'List API Keys', desc: 'List API keys for this tenant.', body: null, response: null },
  { method: 'POST', path: '/api/admin/keys', title: 'Create API Key', desc: 'Create an API key. The raw key is returned once.', body: null, response: null },
  { method: 'DELETE', path: '/api/admin/keys/:id', title: 'Revoke API Key', desc: 'Revoke an API key.', body: null, response: null },
  { method: 'GET', path: '/api/admin/transactions', title: 'List Transactions', desc: 'List credit transactions.', body: null, response: null },
  { method: 'GET', path: '/api/admin/usage', title: 'Usage Stats', desc: 'Usage and credit spend by endpoint and day.', body: null, response: null },
]

const errorCodes = [
  { code: 'unauthorized', status: 401, action: 'provide_valid_api_key' },
  { code: 'validation_error', status: 400, action: 'fix_request_body' },
  { code: 'not_found', status: 404, action: 'check_resource_id' },
  { code: 'rate_limited', status: 429, action: 'wait_and_retry' },
  { code: 'payment_required', status: 402, action: 'send_payment' },
  { code: 'internal_error', status: 500, action: 'retry' },
]

export default function DocsPage() {
  return (
    <div className="relative z-10">
      <FAQSchema />
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-16">
          <h1 className="text-4xl font-bold tracking-tight mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
            Neura API
          </h1>
          <p className="text-lg text-white/40 mb-6 leading-relaxed">
            External brain for AI agents — persistent memory and state via HTTP.
            Designed so agents can use it without human help.
          </p>
        </header>

        {/* Auth */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Authentication</h2>
          <div className="bg-white/5 border-2 border-white/10 p-4 font-mono text-sm">
            Authorization: Bearer sk-xxx
          </div>
          <p className="mt-2 text-sm text-white/30">
            All requests require this header. Generate API keys via the dashboard.
          </p>
        </section>

        {/* Endpoints */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'var(--font-syne)' }}>Endpoints</h2>
          <div className="space-y-6">
            {endpoints.map((ep) => (
              <div key={`${ep.method}-${ep.path}`} className="border-2 border-white/10 bg-white/[0.02] p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className={`text-xs font-bold px-2 py-1 border ${
                      ep.method === 'GET'
                        ? 'bg-white/10 text-white border-white/20'
                        : ep.method === 'POST'
                        ? 'bg-white/20 text-white border-white/30'
                        : ep.method === 'PATCH'
                        ? 'bg-white/10 text-white/60 border-white/20'
                        : 'bg-white/10 text-white/40 border-white/20'
                    }`}
                  >
                    {ep.method}
                  </span>
                  <code className="text-sm font-mono">{ep.path}</code>
                </div>
                <h3 className="font-bold mb-1" style={{ fontFamily: 'var(--font-syne)' }}>{ep.title}</h3>
                <p className="text-sm text-white/40 mb-3">{ep.desc}</p>
                {ep.body && (
                  <div className="mb-2">
                    <div className="text-xs text-white/30 mb-1">Request body:</div>
                    <pre className="bg-black border border-white/10 p-3 text-xs font-mono overflow-x-auto">{ep.body}</pre>
                  </div>
                )}
                <div>
                  <div className="text-xs text-white/30 mb-1">Response:</div>
                  <pre className="bg-black border border-white/10 p-3 text-xs font-mono overflow-x-auto">{ep.response}</pre>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Errors */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Error Format</h2>
          <p className="text-sm text-white/40 mb-4">
            Every error is machine-readable. Agents use the <code className="text-xs bg-white/10 px-1 border border-white/10">code</code> and <code className="text-xs bg-white/10 px-1 border border-white/10">action</code> fields to self-heal.
          </p>
          <pre className="bg-black border-2 border-white/10 p-4 text-xs font-mono mb-6 overflow-x-auto">{`{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded",
    "action": "wait_and_retry",
    "retry_after": 5,
    "docs_url": "https://neura.sh/docs/..."
  }
}`}</pre>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-2 border-white/10">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left py-2 px-4 font-bold" style={{ fontFamily: 'var(--font-syne)' }}>Code</th>
                  <th className="text-left py-2 px-4 font-bold" style={{ fontFamily: 'var(--font-syne)' }}>Status</th>
                  <th className="text-left py-2 px-4 font-bold" style={{ fontFamily: 'var(--font-syne)' }}>Agent Action</th>
                </tr>
              </thead>
              <tbody>
                {errorCodes.map((ec) => (
                  <tr key={ec.code} className="border-b border-white/5">
                    <td className="py-2 px-4 font-mono text-xs">{ec.code}</td>
                    <td className="py-2 px-4 text-white/60">{ec.status}</td>
                    <td className="py-2 px-4 font-mono text-xs text-white/30">{ec.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limiting */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Rate Limiting</h2>
          <p className="text-sm text-white/40 mb-3">
            100 requests per 60 seconds per API key. Exceeded requests return 429.
          </p>
          <div className="text-sm space-y-1">
            <p>Every response includes <code className="text-xs bg-white/10 border border-white/10 px-1">X-RateLimit-Limit</code>, <code className="text-xs bg-white/10 border border-white/10 px-1">X-RateLimit-Remaining</code>, and <code className="text-xs bg-white/10 border border-white/10 px-1">X-RateLimit-Reset</code>.</p>
            <p><code className="text-xs bg-white/10 border border-white/10 px-1">Retry-After</code> — seconds to wait on 429</p>
          </div>
        </section>

        {/* Idempotency */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Idempotency</h2>
          <p className="text-sm text-white/40">
            All memory and state write endpoints accept an <code className="text-xs bg-white/10 border border-white/10 px-1">Idempotency-Key</code> header.
            That is <code className="text-xs bg-white/10 border border-white/10 px-1">POST /api/memory</code>, <code className="text-xs bg-white/10 border border-white/10 px-1">POST /api/memory/batch</code>, <code className="text-xs bg-white/10 border border-white/10 px-1">PATCH /api/memory/:id</code>, <code className="text-xs bg-white/10 border border-white/10 px-1">POST /api/memory/:id/share</code>, <code className="text-xs bg-white/10 border border-white/10 px-1">POST /api/state</code>, and <code className="text-xs bg-white/10 border border-white/10 px-1">DELETE /api/state/:key</code>.
            A replay returns the original response with <code className="text-xs bg-white/10 border border-white/10 px-1">X-Idempotency-Replayed: true</code> and is not charged twice.
            Cached for 24 hours. Use this for safe retries.
          </p>
        </section>

        {/* SDKs */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>SDKs</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/10">
            <div className="bg-black p-6 border border-white/5">
              <h3 className="font-bold mb-2" style={{ fontFamily: 'var(--font-syne)' }}>TypeScript</h3>
              <pre className="bg-white/5 border border-white/10 p-3 text-xs font-mono overflow-x-auto">{`import { Neura } from 'neura-api'

const neura = new Neura({ apiKey: 'sk-...' })
await neura.memory.create({ content: '...' })
const r = await neura.memory.search('...')`}</pre>
              <p className="mt-2 text-xs text-white/30">0 deps, ESM + CJS, auto-retry</p>
              <p className="mt-1 text-xs text-white/20">npm install neura-api</p>
            </div>
            <div className="bg-black p-6 border border-white/5">
              <h3 className="font-bold mb-2" style={{ fontFamily: 'var(--font-syne)' }}>Python</h3>
              <pre className="bg-white/5 border border-white/10 p-3 text-xs font-mono overflow-x-auto">{`from neura import Neura

neura = Neura(api_key="sk-...")
neura.memory.create(content="...")
r = neura.memory.search("...")`}</pre>
              <p className="mt-2 text-xs text-white/30">0 deps, stdlib only, auto-retry</p>
              <p className="mt-1 text-xs text-white/20">pip install neura-api-python</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
