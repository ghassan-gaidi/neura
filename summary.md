# Neura — Project Status

**Last updated:** 2026-06-27 (Phase 9 complete, SDKs published)
**Repo:** https://github.com/ghassan-gaidi/neura
**Local path:** /home/leo/projects/neura

## Git State

- **Remote:** origin → https://github.com/ghassan-gaidi/neura (fetch + push, working)
- **HEAD:** a9e54a3 — `SDK v0.3.0: batch ops, webhooks, admin, credits APIs`
- **Branch:** main

## Deployment Health

- **Homepage** https://neura-blond.vercel.app/ — HTTP 200 ✓
- **API /api/credits** (unauthenticated) — HTTP 401 ✓ (auth gate working)
- **Vercel crons:** 3 daily jobs (payments poll 0:00, webhook retry 6:00, memory TTL 12:00)
- **Project ID:** prj_t8HAisjHsSNKs4Xc5zGv02TuDsNp

## Stack

- **Next.js** 16.2.6 + React 19.2.4 (App Router)
- **Supabase** project ref `hykistvnlfhiywuifcak` (pgvector for embeddings)
- **Voyage AI** embeddings (1024 dim) with **Gemini** fallback
- **Vercel KV** for rate limiting
- **TypeScript** 5 + Tailwind 4

## Database Schema (Supabase)

7 migrations applied:

| # | File | Purpose |
|---|------|---------|
| 001 | `001_schema.sql` | Core: api_keys, memories, states, agents |
| 002 | `002_webhooks_sharing.sql` | Webhooks + memory sharing + delivery log |
| 003 | `003_credits_payments.sql` | Credits + payment transactions |
| 004 | `004_deduct_credits.sql` | RPC: deduct_credits |
| 005 | `005_redeem_payment.sql` | RPC: redeem_payment |
| 006 | `006_self_serve_signup.sql` | Users table + auth infrastructure |
| 007 | `007_fix_signup_trigger.sql` | Fix `create_user_api_key()` — add `balance_after` + `ON CONFLICT` |

## API Routes (28 endpoints)

**Memory (8):** POST/GET `/api/memory`, `POST /api/memory/batch`, `DELETE /api/memory/batch`, `POST /api/memory/search`, `POST /api/memory/summarize`, `PATCH/DELETE /api/memory/[id]`, `POST /api/memory/[id]/share`, `GET /api/memory/cleanup`
**State (3):** POST/GET/DELETE `/api/state`, `/api/state/[key]`
**Webhooks (5):** POST/GET `/api/webhooks`, `GET/PATCH/DELETE /api/webhooks/[id]`, `POST /api/webhooks/retry`
**Sharing (1):** `GET /api/shared-with-me`
**Payments (2):** `POST /api/payments/verify`, `GET /api/payments/poll` (cron)
**Credits (1):** `GET /api/credits`
**Admin (4):** `GET/POST /api/admin/keys`, `DELETE /api/admin/keys/[id]`, `GET /api/admin/transactions`, `GET /api/admin/usage`
**Auth (2):** `GET /api/auth/me`, `POST /api/auth/create-key`
**Other (1):** `POST /api/migrate`

## Auth & Signup

- **Signup flow:** `/signup` → Supabase Auth → `GET /api/auth/me` auto-creates profile + API key + 1,000 free credits
- **Triggers removed:** `on_auth_user_created` and `on_user_created` were crashing auth. All provisioning is now app-layer in `/api/auth/me`.
- **Signup verified working** end-to-end ✓

## Credits Pricing

| Operation | Cost |
|-----------|------|
| Store memory | 1 |
| Search (GET /api/memory) | 1 |
| Advanced search (POST /api/memory/search) | 2 |
| Update memory | 1 |
| Summarize memories | 5 |
| Batch create (per memory) | 1 |
| Delete / State / Webhooks / Sharing / Batch delete | 0 (free) |

**Top-up:** 1000 credits for $1 USDC on Base → wallet `0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef`

## SDKs (Published)

| Package | Version | Install |
|---------|---------|---------|
| **npm** `neura-api` | 0.3.0 | `npm install neura-api` |
| **PyPI** `neura-api-python` | 0.3.0 | `pip install neura-api-python` |

Both SDKs support: Memory (CRUD + batch + summarize + share), State, Webhooks, Admin (keys, transactions, usage), Credits, and x402 auto-payment.

## Feature Summary

- ✅ Persistent memory with auto-embedding (Voyage AI → Gemini fallback)
- ✅ Semantic search with cosine similarity scoring
- ✅ Advanced search with tag/date/importance filters
- ✅ Batch create (25/batch) + batch delete (100/batch)
- ✅ Memory TTL expiration + cleanup cron
- ✅ Key-value state storage
- ✅ Webhooks with HMAC signing + exponential backoff retry (5 attempts)
- ✅ API key management dashboard (list, create, revoke)
- ✅ Rate limiting (100 req/min) with headers on all responses
- ✅ Idempotency keys on write endpoints
- ✅ Self-serve signup with magic link + auto API key provisioning
- ✅ On-chain USDC payments on Base (x402 protocol)
- ✅ OpenAPI 3.1 spec (22 paths)
- ✅ Full-featured TypeScript and Python SDKs

## Phases Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1-4 | ✅ Done | Core API, credits, payments, deployment |
| 5 | ✅ Done | SDK publish (npm + PyPI) |
| 6 | ✅ Done | Self-serve signup (bugs fixed, triggers removed) |
| 7 | ✅ Done | API key dashboard (key mgmt, revocation) |
| 8 | ✅ Done | Product gaps (webhook retry, rate limit headers, batch ops, TTL cleanup) |
| 9 | ✅ Done | OpenAPI v0.2.0, landing polish, SDK v0.3.0 publish |
