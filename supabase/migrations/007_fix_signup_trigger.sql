-- Fix: signup trigger missing balance_after in credit_transactions INSERT
-- The credit_transactions table requires balance_after (NOT NULL),
-- but create_user_api_key() was inserting without it, causing signup to crash.

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
  -- Note: trg_create_credit_balance (on api_keys AFTER INSERT) may already
  -- have inserted the row, so we use ON CONFLICT DO NOTHING to avoid duplicate key
  INSERT INTO public.credit_balances (tenant_id, balance)
  VALUES (NEW.tenant_id, 1000)
  ON CONFLICT (tenant_id) DO NOTHING;

  -- Log the signup bonus (include balance_after — required NOT NULL column)
  INSERT INTO public.credit_transactions (tenant_id, amount, balance_after, transaction_type, description)
  VALUES (NEW.tenant_id, 1000, 1000, 'signup_bonus', 'Welcome to Neura — 1000 free credits');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
