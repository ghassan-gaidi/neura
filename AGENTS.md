# Neura — External Brain for AI Agents

HTTP API for AI agent persistent memory and state. Semantic search, key-value storage, webhooks, payments. No setup required — just an API key.

## API Endpoints

### Memory (semantic vector storage)
- `POST /api/memory` — Store a memory (auto-embeds via Voyage AI, 1 credit)
- `GET /api/memory` — List memories (free, with pagination)
- `GET /api/memory?query=...` — Semantic search (1 credit)
- `POST /api/memory/search` — Advanced search with filters (2 credits)
- `PATCH /api/memory/:id` — Update a memory (1 credit)
- `DELETE /api/memory/:id` — Delete a memory (free)
- `POST /api/memory/batch` — Store up to 25 memories (1 credit each)
- `DELETE /api/memory/batch` — Delete up to 100 memories (free)
- `POST /api/memory/summarize` — Summarize memories (5 credits)

### State (key-value)
- `POST /api/state` — Upsert key-value state
- `GET /api/state` — List all state keys
- `GET /api/state/:key` — Get a specific state value
- `DELETE /api/state/:key` — Delete a state key

### Webhooks
- `POST /api/webhooks` — Register webhook
- `GET /api/webhooks` — List webhooks
- `PUT /api/webhooks/:id` — Update webhook
- `DELETE /api/webhooks/:id` — Delete webhook
- `POST /api/webhooks/retry` — Manually retry failed deliveries

### Sharing
- `POST /api/memory/:id/share` — Share with another tenant
- `GET /api/memory/:id/share` — List shares
- `DELETE /api/memory/:id/share` — Remove share
- `GET /api/shared-with-me` — Cross-tenant shared memories

### Credits & Payments
- `GET /api/credits` — Balance + pricing + x402 details
- `POST /api/payments/verify` — Verify USDC tx and credit instantly
- `GET /api/payments/poll` — Poll for unverified payments (cron)

### Auth & Admin
- `POST /api/auth/create-key` — Create API key (for signup flow)
- `GET /api/auth/me` — Current user profile + API key
- `GET /api/admin/keys` — List all API keys
- `POST /api/admin/keys` — Create new API key
- `DELETE /api/admin/keys/[id]` — Revoke API key
- `GET /api/admin/usage` — Usage analytics
- `GET /api/admin/transactions` — Credit transaction history

## Auth

All requests require `Authorization: Bearer sk-xxx` header.

## Rate Limiting

- 100 requests per 60 seconds per API key
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
- Exceeded? Returns `429` with `Retry-After` header and `retry_after` in error body

## Idempotency

Write endpoints (`POST`, `PATCH`) accept an `Idempotency-Key` header.
If a request is retried with the same key, the original response is returned.
Cached for 24 hours.

## Errors

Every error returns `{ error: { code, message, action, retry_after?, docs_url? } }`.
Machine-readable so agents can retry intelligently.

## Payments

New agents get **1000 free credits**. When credits run out, the API returns
**402 Payment Required** with x402 payment details.

An agent can pay by sending USDC on Base to the configured wallet, then
retry the request with the transaction hash.

```json
{
  "error": {
    "code": "payment_required",
    "x402": {
      "chain": "base",
      "token": "USDC",
      "amount": "1.00",
      "recipient": "0x2902...C7Ef",
      "description": "1000 Neura credits"
    }
  }
}
```

Check balance: `GET /api/credits`
Top up:       `POST /api/credits/top-up`

### Pricing

| Operation | Credits |
|-----------|---------|
| Store memory | 1 |
| Semantic search | 1 |
| Advanced search | 2 |
| Update memory | 1 |
| Batch store (per item) | 1 |
| Summarize memories | 5 |
| List memories | 0 (free) |
| Delete memory | 0 (free) |
| Batch delete | 0 (free) |
| State operations | 0 (free) |
| Webhooks | 0 (free) |
| Sharing | 0 (free) |

## Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 on Vercel (Serverless Functions) |
| Database | Supabase + pgvector (HNSW index, cosine similarity) |
| Embeddings | Voyage AI voyage-4 (1024d, 200M free tokens, no CC) |
| Rate Limiting | In-memory sliding window (100 req/60s) |
| Payments | Base USDC via direct RPC |
| SDKs | neura-api (npm) · neura-api-python (PyPI) |

## SDK Usage

```ts
import { Neura } from 'neura-api'

const neura = new Neura({ apiKey: 'sk-...' })

// Store
await neura.memory.create({ content: 'User prefers dark mode' })

// Search
const results = await neura.memory.search('UI preferences')

// State
await neura.state.set('theme', 'dark')
const theme = await neura.state.get('theme')
```

```python
from neura import Neura

neura = Neura(api_key='sk-...')

# Store
neura.memory.create(content='User prefers dark mode')

# Search
results = neura.memory.search('UI preferences')

# State
neura.state.set('theme', 'dark')
theme = neura.state.get('theme')
```

## Dev

```bash
npm run dev          # Start dev server
npm run build        # Build for production
```

## Env

See `.env.example` for required environment variables.
