# AGENTS.md — Neura Project

> Context for autonomous agents working in this repo.

## Overview
Crypto intelligence dashboard. Next.js on Vercel, Supabase PostgreSQL backend.

## Tech Stack
- TypeScript/Next.js (App Router)
- Supabase (hykistvnlfhiywuifcak)
- Vercel deployment: neura-blond.vercel.app
- TS SDK: neura-api@0.2.0

## Key Files
- `src/` — Application source
- `supabase/` — Database migrations and config
- `vercel.json` — Deployment config

## Commands
```bash
npm run dev    # Local development
npm run build  # Production build
vercel deploy  # Deploy to production
```

## Architecture
- Server components by default, client components only for interactive UI
- Supabase for auth, database, and realtime
- CF Worker at neura.leo2574.workers.dev for API routing

## Related
- Streak: crypto-price-api.leo2574.workers.dev
- Cron: daily at midnight (0 0 * * *)
