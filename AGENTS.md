# AGENTS.md — Neura

> External brain for AI agents: persistent memory, state, webhooks, and
> self-payable credits, over HTTP.

**Vercel (live):** https://neura-blond.vercel.app  
**Supabase project:** `hykistvnlfhiywuifcak`  
**Note:** the `neura.sh` domain is currently parked (TLS failure) and needs to
be re-registered or pointed at Vercel before it serves the app.  
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
- Voyage AI embeddings (1024 dims), with Gemini fallback
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
