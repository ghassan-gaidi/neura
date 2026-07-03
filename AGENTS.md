# AGENTS.md — Neura

> Crypto intelligence dashboard via Dominion backend.
> Vercel: neura-blond.vercel.app
> Supabase: hykistvnlfhiywuifcak
> TS SDK: neura-api@0.2.0

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
- CF Worker for API routing

## Related
- **Dominion**: Crypto intelligence backend (crypto-empire-ten.vercel.app)
- **PICKR**: Telegram crypto casino (@cr00k_bot)
- Cron: daily at midnight (0 0 * * *)
