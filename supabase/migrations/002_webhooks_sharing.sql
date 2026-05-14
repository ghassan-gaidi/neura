-- Phase 4: Webhooks, shared memory, and summarization

-- ============================================================
-- Webhooks — agents subscribe to events
-- ============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  secret TEXT,                               -- optional HMAC secret for signature
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);

-- ============================================================
-- Webhook Delivery Log — tracks delivery attempts
-- ============================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending, delivered, failed
  status_code INT,
  response_body TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status, next_retry_at);

-- ============================================================
-- Shared Memories — agent-to-agent sharing with allowlists
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  owner_tenant_id UUID NOT NULL,
  target_tenant_id UUID NOT NULL,
  permission TEXT NOT NULL DEFAULT 'read',   -- read, write
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(memory_id, target_tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_shared_memories_target ON shared_memories(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_shared_memories_owner ON shared_memories(owner_tenant_id);

-- ============================================================
-- Update triggers for webhooks
-- ============================================================
DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON webhooks;
CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
