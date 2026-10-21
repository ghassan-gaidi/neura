-- Reconcile the migration history with the live database.
--
-- The live database was provisioned out-of-band: it has RLS on every table
-- and a webhook_deliveries.retry_count column that no migration file creates,
-- and it is missing the two signup triggers that crash provisioning.
-- This migration makes a freshly-reset database behave like the live one.

-- ============================================================
-- Row Level Security — deny anon/authenticated, allow service_role
-- ============================================================
-- The application connects with the service_role key, which bypasses RLS.
-- No policy is created for anon or authenticated, so the public anon key
-- cannot read or write any Neura table.

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_store ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- webhook_deliveries.retry_count — written by src/lib/webhooks.ts
-- ============================================================
ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;

-- ============================================================
-- Signup provisioning is app-layer (/api/auth/me), not trigger-layer.
-- These triggers crashed on signup and were removed from the live database.
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_user_created ON public.users;

-- The functions are left in place (harmless) so this migration is
-- reversible; drop them in a later migration if confirmed unused.
