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
- **Note:** the `neura.sh` domain is currently parked (TLS failure) and needs to
  be re-registered or pointed at Vercel before it serves the app.
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
