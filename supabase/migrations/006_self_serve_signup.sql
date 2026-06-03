-- Phase 6: Self-Serve Signup
-- Links Supabase Auth users to Neura tenants via email.
-- Enables magic link signup → auto API key creation.

-- ============================================================
-- Users — maps Supabase Auth emails to tenant_id
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  tenant_id UUID NOT NULL DEFAULT gen_random_uuid(),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(email),
  UNIQUE(tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

-- ============================================================
-- Auto-create user row on Supabase Auth signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, tenant_id)
  VALUES (NEW.id, NEW.email, gen_random_uuid());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: when a new auth user is created, insert into public.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Auto-create API key + 1000 free credits on user signup
-- ============================================================
CREATE OR REPLACE FUNCTION create_user_api_key()
RETURNS TRIGGER AS $$
DECLARE
  raw_key TEXT;
  key_hash TEXT;
  api_key_id UUID;
BEGIN
  -- Generate a random API key
  raw_key := 'sk-' || encode(gen_random_bytes(32), 'hex');
  key_hash := encode(digest(raw_key, 'sha256'), 'hex');

  -- Insert the API key
  INSERT INTO public.api_keys (id, tenant_id, key_hash, label)
  VALUES (gen_random_uuid(), NEW.tenant_id, key_hash, 'default')
  RETURNING id INTO api_key_id;

  -- Seed 1000 free credits
  INSERT INTO public.credit_balances (tenant_id, balance)
  VALUES (NEW.tenant_id, 1000);

  -- Log the signup bonus
  INSERT INTO public.credit_transactions (tenant_id, amount, transaction_type, description)
  VALUES (NEW.tenant_id, 1000, 'signup_bonus', 'Welcome to Neura — 1000 free credits');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: when a user row is created, create API key + credits
DROP TRIGGER IF EXISTS on_user_created ON public.users;
CREATE TRIGGER on_user_created
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION create_user_api_key();

-- ============================================================
-- Enable Row Level Security (RLS) on users table
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can only read their own row
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- ============================================================
-- Enable email-based signups in Supabase Auth
-- (This is done via Supabase Dashboard > Authentication > Providers > Email)
-- But we ensure the config is correct:
--   - Enable email signups
--   - Disable email confirmations (magic link only)
--   - Set mailer expiry to 300 seconds
-- ============================================================
