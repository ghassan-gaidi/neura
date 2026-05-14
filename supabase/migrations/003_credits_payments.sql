-- Phase 2: Credits and payment system

-- ============================================================
-- Credit Balances — per-tenant credit tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_balances (
  tenant_id UUID PRIMARY KEY,
  balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_purchased INT NOT NULL DEFAULT 0,
  total_consumed INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Credit Transactions — audit log for all credit movements
-- ============================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  amount INT NOT NULL,                       -- positive = purchase, negative = spend
  balance_after INT NOT NULL,
  transaction_type TEXT NOT NULL,             -- 'purchase', 'spend', 'bonus', 'refund'
  description TEXT,
  reference_id TEXT,                          -- payment tx hash or memory id
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_tenant ON credit_transactions(tenant_id, created_at DESC);

-- ============================================================
-- Seed 1000 free credits for existing tenants
-- ============================================================
INSERT INTO credit_balances (tenant_id, balance, total_purchased, total_consumed)
SELECT DISTINCT tenant_id, 1000, 1000, 0
FROM api_keys
WHERE tenant_id NOT IN (SELECT tenant_id FROM credit_balances)
ON CONFLICT (tenant_id) DO NOTHING;

-- ============================================================
-- Trigger to auto-create balance row on new tenant
-- ============================================================
CREATE OR REPLACE FUNCTION create_credit_balance()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO credit_balances (tenant_id, balance, total_purchased, total_consumed)
  VALUES (NEW.tenant_id, 1000, 1000, 0)
  ON CONFLICT (tenant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_credit_balance ON api_keys;
CREATE TRIGGER trg_create_credit_balance
  AFTER INSERT ON api_keys
  FOR EACH ROW
  EXECUTE FUNCTION create_credit_balance();
