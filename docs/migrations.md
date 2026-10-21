# Neura Database Migrations

## Applying migrations

Two supported paths:

1. **Supabase CLI (preferred)** — requires an access token whose org owns project `hykistvnlfhiywuifcak`. Attempted `supabase link --project-ref hykistvnlfhiywuifcak` on 2026-10-21 and failed with `LegacyLinkProjectStatusError`: "Your account does not have the necessary privileges to access this endpoint." The authenticated CLI token belongs to a different org (TalentRadar/saas); the project owner must either `supabase logout && supabase login` with the owning account or use the dashboard path.
2. **Dashboard SQL editor** — paste the contents of each migration file in numeric order into Supabase Dashboard → SQL Editor and run them.

## Migration file set (final, after 3.3/3.2 renumber + 012)

| # | File | Purpose |
|---|---|---|
| 001 | `001_schema.sql` | Core schema: `api_keys`, `memories`, `state_store`, `usage_logs`; `extensions.vector`; triggers; `search_memories` RPC |
| 002 | `002_webhooks_sharing.sql` | `webhooks`, `webhook_deliveries`, `shared_memories`; webhook indexes |
| 003 | `003_credits_payments.sql` | `credit_balances`, `credit_transactions`; `trg_create_credit_balance` trigger |
| 004 | `004_deduct_credits.sql` | `deduct_credits` RPC (atomic with `FOR UPDATE`) |
| 005 | `005_redeem_payment.sql` | `redeem_payment` RPC (idempotent by transaction hash) |
| 006 | `006_self_serve_signup.sql` | `users`; `on_auth_user_created` / `on_user_created` triggers; RLS on `users`; `Users can read own profile` policy |
| 007 | `007_embeddings_dim_1024.sql` | Migrate embeddings 1536 → 1024 dims; recreate `search_memories`; HNSW index |
| 008 | `008_fix_signup_trigger.sql` | Fix `create_user_api_key()` missing `balance_after`; renumbered from 007 (duplicate prefix); trigger dropped by 012 |
| 009 | `009_harden_credit_balances.sql` | Remove self-granting behavior from `deduct_credits`; zero-balance instead of 1000 |
| 010 | `010_payment_idempotency.sql` | Unique partial index on `credit_transactions(reference_id)` for `purchase`; idempotent `redeem_payment` |
| 011 | `011_search_with_filters.sql` | `search_memories_filtered` (filters before LIMIT) |
| 012 | `012_enable_rls.sql` | Reconcile live DB: enable RLS all 10 tables; add `retry_count`; drop crashing signup triggers |

## Live-vs-migration drift (as of 2026-10-20, reconciled by 012)

| Object | Live | Migration | Reconciled by |
|---|---|---|---|
| RLS enabled on all 10 tables | yes | no (only 006 on `users`) | `012_enable_rls.sql` |
| `webhook_deliveries.retry_count` | yes | no (002 lacks column) | `012_enable_rls.sql` |
| `trg_create_credit_balance` on `api_keys` | yes | yes (003) | — |
| `on_auth_user_created` trigger | no | yes (006) | `012_enable_rls.sql` (drops) |
| `on_user_created` trigger | no | yes (006/007) | `012_enable_rls.sql` (drops) |
| Deduct 0 when no row (not 1000) | yes | yes (009) | — |

## Invariants

- Embeddings are `vector(1024)`.
- `search_memories` and `search_memories_filtered` take `vector(1024)`.
- `credit_transactions.reference_id` is unique for `transaction_type = 'purchase'`.
- Every migration is idempotent and may be re-run.
