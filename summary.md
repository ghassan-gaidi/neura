# Neura — Project Status

**Last updated:** 2026-06-27 (Phase 7 complete)
**Repo:** https://github.com/ghassan-gaidi/neura
**Local path:** /mnt/c/Users/gg257/Desktop/neura/neura

## Git State

- **Remote:** origin → https://github.com/ghassan-gaidi/neura (fetch + push, working)
- **HEAD:** a6a8542 — `Phase 6: Self-serve signup with magic link auth`
- **Branch:** main
- **Working tree:** clean
- **Recent commits:**
  - a6a8542 Phase 6: Self-serve signup with magic link auth
  - 1a60d2b chore: add .gitattributes to enforce LF line endings
  - bbd6094 feat: brutalist UI, SEO/GEO optimization, JSON-LD schemas
  - 3df77c4 feat: launch prep — landing page and publication guide
  - ed09185 feat: production hardening — CORS, logging, configurable rate limiting

## Deployment Health

- **Homepage** https://neura-blond.vercel.app/ — HTTP 200 ✓
- **API /api/credits** (unauthenticated) — HTTP 401 ✓ (auth gate working)
- **Vercel cron:** `*/5 * * * *` → `GET /api/payments/poll` (active)
- **Project ID:** prj_t8HAisjHsSNKs4Xc5zGv02TuDsNp
- **⚠️ Supabase project PAUSED** — needs unpause before migration 006 can deploy

## Stack

- **Next.js** 16.2.6 + React 19.2.4 (App Router)
- **Supabase** project ref `hykistvnlfhiywuifcak` (pgvector for embeddings)
- **OpenAI** text-embedding-3-small (1536 dims)
- **Vercel KV** for rate limiting
- **TypeScript** 5 + Tailwind 4

## Database Schema (Supabase)

6 migrations, 10 tables (9 existing + 1 new), 3 RPCs:

| # | File | Purpose |
|---|------|---------|
| 001 | `001_schema.sql` | Core: api_keys, memories, states, agents |
| 002 | `002_webhooks_sharing.sql` | Webhooks + memory sharing |
| 003 | `003_credits_payments.sql` | Credits + payment transactions |
| 004 | `004_deduct_credits.sql` | RPC: deduct_credits |
| 005 | `005_redeem_payment.sql` | RPC: redeem_payment |
| 006 | `006_self_serve_signup.sql` | **NEW:** Users table + auth triggers (BLOCKED — project paused) |

## API Routes (19 endpoints)

**Memory (5):** POST/GET/PATCH/DELETE `/api/memory`, `/api/memory/:id`, `/api/memory/search`, `/api/memory/summarize`
**State (3):** POST/GET/DELETE `/api/state`, `/api/state/:key`
**Webhooks (3):** `/api/webhooks`, `/api/webhooks/:id`
**Sharing (2):** `/api/memory/:id/share`, `/api/shared-with-me`
**Payments (2):** `/api/payments/verify`, `/api/payments/poll` (cron)
**Credits (1):** `/api/credits`
**Admin (3):** `/api/admin/keys`, `/api/admin/transactions`, `/api/admin/usage`
**Auth (2):** `/api/auth/me`, `/api/auth/create-key` ← NEW

## Auth & Signup (Phase 6)

- **Signup flow:** `/signup` → email magic link → `/auth/callback` → auto API key + 1000 credits
- **Dashboard:** Auto-detects Supabase session, stores API key in localStorage
- **Free tier:** 100 memories max, 1000 credits, all endpoints
- **Pro tier:** Unlimited memories + credits ($1 USDC / 1000 credits)

### BLOCKED — Supabase Auth Setup Required

After unpausing the project, must:
1. Run migration 006 via SQL Editor
2. Enable Email auth: Dashboard > Authentication > Providers > Email
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel env

## Credits Pricing

| Operation | Cost |
|-----------|------|
| Store memory | 1 |
| Search (GET /api/memory) | 1 |
| Advanced search (POST /api/memory/search) | 2 |
| Update memory | 1 |
| Summarize memories | 5 |
| Delete / State / Webhooks / Sharing | 0 (free) |

**Top-up:** 1000 credits for $1 USDC on Base → wallet `0x29021dd5306D7b3b6608a2bc8276D33c1200C7Ef`

## SDKs (Published)

- **npm:** `neura-api@0.2.0` — https://www.npmjs.com/package/neura-api
- **PyPI:** `neura-api-python@0.1.0` — https://pypi.org/project/neura-api-python/
- **Install:** `npm install neura-api` / `pip install neura-api-python`

## Gaps / Missing

- ❌ **Supabase project PAUSED** — migration 006 can't deploy until unpaused
- ❌ No `.env.local` locally — Supabase + OpenAI creds live in Vercel dashboard
- ❌ Supabase Auth not configured (email provider disabled)
- ❌ NEXT_PUBLIC env vars missing from Vercel (needed for browser auth client)
- ⚠️ Memory at 84% capacity — consider pruning old entries

## Phases Progress

| Phase | Status | Description |
|-------|--------|-------------|
| 1-4 | ✅ Done | Core API, credits, payments, deployment |
| 5 | ✅ Done | SDK publish (npm + PyPI) |
| 6 | ✅ Code done | Self-serve signup (BLOCKED on Supabase unpause) |
| 7 | 🔜 Next | API key dashboard (key mgmt, usage stats) |
| 8 | ⏳ Pending | Product gaps (webhook retry, rate limit headers) |
| 9 | ⏳ Pending | Growth (landing polish, launch post) |

## Tokens (local secrets file)

- Supabase ACCESS_TOKEN: `sbp_22d7ae2...` (project-scoped)
- Vercel token: `vcp_84I4km...` (ghassan-gaidis-projects/neura)
