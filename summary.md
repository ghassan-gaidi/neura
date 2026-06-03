# Neura — Project Status

**Last regenerated:** 2026-06-03
**Repo:** https://github.com/ghassan-gaidi/neura
**Local path:** /mnt/c/Users/gg257/Desktop/neura/neura

## Git State

- **Remote:** origin → https://github.com/ghassan-gaidi/neura (fetch + push, working)
- **HEAD:** 1a60d2b — `chore: add .gitattributes to enforce LF line endings`
- **Branch:** main
- **Working tree:** clean (only untracked `summary.md` from this regen)
- **Recent commits:**
  - 1a60d2b chore: add .gitattributes to enforce LF line endings
  - bbd6094 feat: brutalist UI, SEO/GEO optimization, JSON-LD schemas
  - 3df77c4 feat: launch prep — landing page and publication guide
  - ed09185 feat: production hardening — CORS, logging, configurable rate limiting
  - 8f3cbeb feat: agent framework integrations
- **Push status:** ✓ verified via `git ls-remote origin HEAD` — connectivity confirmed

## Deployment Health

- **Homepage** https://neura-blond.vercel.app/ — HTTP 200 (~0.58s) ✓
- **API /api/credits** (unauthenticated) — HTTP 401 ✓ (auth gate working as expected)
- **Vercel cron:** `*/5 * * * *` → `GET /api/payments/poll` (active)
- **Project ID:** prj_t8HAisjHsSNKs4Xc5zGv02TuDsNp

## Stack

- **Next.js** 16.2.6 + React 19.2.4 (App Router)
- **Supabase** project ref `hykistvnlfhiywuifcak` (pgvector for embeddings)
- **OpenAI** text-embedding-3-small (1536 dims)
- **Vercel KV** for rate limiting (creds missing locally)
- **TypeScript** 5 + Tailwind 4

## Database Schema (Supabase)

5 migrations, 9 tables, 3 RPCs:

| # | File | Purpose |
|---|------|---------|
| 001 | `001_schema.sql` | Core: api_keys, memories, states, agents |
| 002 | `002_webhooks_sharing.sql` | Webhooks + memory sharing |
| 003 | `003_credits_payments.sql` | Credits + payment transactions |
| 004 | `004_deduct_credits.sql` | RPC: deduct_credits |
| 005 | `005_redeem_payment.sql` | RPC: redeem_payment |

## API Routes (16 endpoints)

**Memory (5):** POST/GET/PATCH/DELETE `/api/memory`, `/api/memory/:id`, `/api/memory/search`, `/api/memory/summarize`
**State (3):** POST/GET/DELETE `/api/state`, `/api/state/:key`
**Webhooks (3):** `/api/webhooks`, `/api/webhooks/:id`
**Sharing (2):** `/api/memory/:id/share`, `/api/shared-with-me`
**Payments (2):** `/api/payments/verify`, `/api/payments/poll` (cron)
**Credits (1):** `/api/credits`
**Admin (3):** `/api/admin/keys`, `/api/admin/transactions`, `/api/admin/usage`

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

## SDKs (v0.1.0, NOT published)

- `sdk/typescript/` — name: `neura-api`, MIT, ready for `npm publish`
- `sdk/python/` — name: `neura-api`, MIT, ready for `twine upload`

## Gaps / Missing

- ❌ No `.env.local` locally — Supabase + OpenAI + Vercel KV creds live in Vercel project env, not on disk
- ❌ SDKs not published to npm/PyPI
- ❌ Vercel KV credentials absent from `.env.example` (must be set in Vercel dashboard)
- ⚠️ Memory at 84% capacity — consider pruning old entries

## Next Milestones

- **Phase 5:** Publish SDKs to npm + PyPI
- **Phase 6:** API key self-serve signup flow (currently manual via Supabase)
- **Phase 7:** Usage analytics dashboard
- **Phase 8:** Webhook retry logic + dead-letter queue

## Tokens (local secrets file)

- Supabase ACCESS_TOKEN: `sbp_22d7ae2...` (project-scoped)
- Vercel token: `vcp_84I4km...` (ghassan-gaidis-projects/neura)
