# Neura — Launch Guide

## SDK Publication (done — published as `neura-api`)

| Registry | Package | Install |
|----------|---------|---------|
| npm | `neura-api` | `npm install neura-api` |
| PyPI | `neura-api` | `pip install neura-api` |

See `references/sdk-publishing-pitfalls.md` for gotchas encountered.

## Vercel Deploy

1. GitHub repo auto-deploys to Vercel on push to `main`
2. Required env vars:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `VOYAGE_API_KEY`
   - `PAYMENT_WALLET_ADDRESS`, `CREDIT_PRICE_PER_THOUSAND`, `MIN_TOP_UP_CREDITS`
   - `BASE_RPC_URL`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy trick (Hobby plan): `npx vercel deploy --yes` (preview) → then `npx vercel --prod --yes`
4. Vercel Cron: `0 0 * * *` for daily payment poll + webhook retry

## Launch Checklist

- [x] Core API: 28 endpoints — memory CRUD, batch ops, semantic search, state, webhooks, sharing, credits, payments, admin
- [x] TypeScript SDK published to npm (`neura-api@0.3.0`)
- [x] Python SDK published to PyPI (`neura-api-python@0.3.0`)
- [x] Landing page with hero, stats bar, features grid, pricing, code examples
- [x] Dashboard with Usage, Billing, Memories, Keys, State tabs
- [x] OpenAPI 3.1 spec at `/openapi.yaml` (22 paths, all schemas)
- [x] SEO/GEO: sitemap.xml, robots.txt, JSON-LD (Organization, FAQPage, APIReference, SoftwareApplication)
- [x] Security: CSP, HSTS, rate limiting, idempotency
- [x] Self-serve signup with magic link + auto API key provisioning
- [x] Embeddings: Voyage AI voyage-4 (200M free tokens, no CC needed)
- [x] Payments: Base USDC via direct RPC verification (no API key needed)
- [x] Webhook retry with exponential backoff (30s → 2min → 10min → 1hr → 6hr)
- [x] Memory TTL cleanup cron
- [x] Brutalist B&W design with matrix rain
- [ ] Google Search Console: submit sitemap at `/sitemap.xml`
- [ ] Launch posts: Show HN, Reddit (r/MachineLearning, r/LocalLLaMA), Dev.to, X/Twitter

## Launch Posts

### Show HN
Title: "Neura – External brain for AI agents"
Content: Focus on the "zero setup for agents" angle. Show the 4-line SDK example.
Tag: `show`

### Reddit (r/MachineLearning, r/LocalLLaMA, r/AI)
Title: "I built an HTTP API that gives AI agents persistent memory — what do you think?"
Content: Technical deep-dive on the architecture. pgvector, x402, SDKs.

### Dev.to
Title: "Building an external brain for AI agents"
Content: Tutorial-style. Walk through the problem, the API, and how to use it.

### X/Twitter
Short demo video or code screenshot. Tag @LeoFalco2574.

## Post-Launch Monitoring

- Watch Vercel logs for errors
- Check `credit_transactions` table for first purchase
- Check Basescan for incoming USDC
- Iterate based on feedback
