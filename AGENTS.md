# Neura — External Brain for AI Agents

Agents send HTTP requests to store facts, preferences, past results, and state.
Retrieve them with natural language semantic search. No setup, no SDK required.

## API

- `POST /api/memory` — Store a memory (auto-embeds via OpenAI)
- `GET /api/memory?query=...` — Semantic search
- `POST /api/memory/search` — Advanced search with filters
- `PATCH /api/memory/:id` — Update a memory
- `DELETE /api/memory/:id` — Delete a memory
- `POST /api/state` — Upsert key-value state
- `GET /api/state` — List all state keys
- `GET /api/state/:key` — Get a specific state value
- `DELETE /api/state/:key` — Delete a state key

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
| Summarize memories | 5 |
| List memories | 0 (free) |
| Delete memory | 0 (free) |
| State operations | 0 (free) |
| Webhooks | 0 (free) |
| Sharing | 0 (free) |

## Stack

- **Next.js 16** on Vercel (Serverless Functions)
- **Supabase** + pgvector
- **OpenAI** text-embedding-3-small
- **Vercel KV** for rate limiting

## Dev

```bash
npm run dev          # Start dev server
npm run build        # Build for production
```

## Env

Copy `.env.example` to `.env.local` and fill in Supabase + OpenAI credentials.
