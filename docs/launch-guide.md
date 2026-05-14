# Neura — Launch Guide

## Domains

Recommended:
- `neura.sh` — primary API domain
- `neura.dev` — developer docs alternate
- Set as `A` record or `CNAME` to Vercel

## SDK Publication

### TypeScript (npm)

```bash
cd sdk/typescript

# Build
npm run build

# Login (one time)
npm login

# Publish
npm publish --access public
```

**Prerequisites:** `package.json` name is `neura` — check if that name is available on npm. 
If taken, use `@ghassan-gaidi/neura` or `neura-api`.

### Python (PyPI)

```bash
cd sdk/python

# Build
pip install build
python -m build

# Upload
pip install twine
twine upload dist/*
```

**Prerequisites:** `pyproject.toml` name is `neura` — check availability on PyPI.

## Vercel Deploy

1. GitHub repo auto-deploys to Vercel
2. Set env vars in Vercel dashboard:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `OPENAI_API_KEY`
   - `PAYMENT_WALLET_ADDRESS`
   - `CREDIT_PRICE_PER_THOUSAND`, `MIN_TOP_UP_CREDITS`
   - `BASE_RPC_URL`
3. Domain: set custom domain in Vercel → Project → Settings → Domains

## Launch Checklist

- [ ] Custom domain configured
- [ ] TypeScript SDK published to npm
- [ ] Python SDK published to PyPI
- [ ] SDK READMEs updated with final install command
- [ ] Paying yourself: send a small USDC test payment from a wallet, verify credits arrive
- [ ] Run the Vercel Cron to confirm polling works
- [ ] Test a full agent flow end-to-end

## Launch Posts

### Show HN
Title: "Neura – External brain for AI agents"
Content: Focus on the "zero setup for agents" angle. Show the 4-line example.
Tag: `show`

### Reddit (r/MachineLearning, r/LocalLLaMA, r/AI)
Title: "I built an HTTP API that gives AI agents persistent memory — what do you think?"
Content: Technical deep-dive on the architecture. pgvector, x402, SDKs.

### Dev.to
Title: "Building an external brain for AI agents"
Content: Tutorial-style. Walk through the problem, the API, and how to use it.

### X/Twitter
Short demo video or code screenshot. Tag @LeoFalco2574.

## First Customer Flow

1. Dev visits neura.sh
2. Reads the one-liner code example
3. Signs up (generates API key via dashboard)
4. Uses the SDK in their agent
5. 1000 free credits — enough for ~1000 operations
6. When credits run out, agent auto-pays via USDC or dev tops up
7. Revenue hits your wallet on Base

## Post-Launch

- Monitor Vercel logs for errors
- Watch credit_transactions table for first purchase
- Check Basescan for incoming USDC
- Iterate based on feedback
