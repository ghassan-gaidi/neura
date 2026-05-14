-- Neura schema — dedicated Supabase project, uses public schema directly.
-- If colocating with another app, wrap in CREATE SCHEMA neura and set search_path.

-- Enable pgvector extension (safe if already exists)
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ============================================================
-- API Keys — tenants for multi-agent isolation
-- ============================================================
-- Note: no FK on tenant_id — multiple keys per tenant, control via app logic.
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================
-- Memories — vector-searchable long-term storage
-- ============================================================
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  content TEXT NOT NULL,
  embedding extensions.vector(1536),
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  importance INT DEFAULT 0 CHECK (importance >= 0 AND importance <= 10),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memories_tenant ON memories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_tags ON memories USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_memories_metadata ON memories USING GIN(metadata jsonb_path_ops);

-- HNSW index (requires pgvector >= 0.5.0, search path needs extensions schema for operator class)
SET search_path TO public, extensions;
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
SET search_path TO public;

-- ============================================================
-- State Store — persistent key-value for agent context
-- ============================================================
CREATE TABLE IF NOT EXISTS state_store (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key)
);

CREATE INDEX IF NOT EXISTS idx_state_tenant ON state_store(tenant_id);

-- ============================================================
-- Usage Logs — per-request accounting
-- ============================================================
CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  api_key_id UUID,
  endpoint TEXT NOT NULL,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant ON usage_logs(tenant_id, created_at DESC);

-- ============================================================
-- Auto-update updated_at trigger
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_memories_updated_at ON memories;
CREATE TRIGGER trg_memories_updated_at
  BEFORE UPDATE ON memories FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_state_updated_at ON state_store;
CREATE TRIGGER trg_state_updated_at
  BEFORE UPDATE ON state_store FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Vector Search RPC — returns memories by cosine similarity
-- ============================================================
CREATE OR REPLACE FUNCTION search_memories(
  p_tenant_id UUID,
  p_embedding extensions.vector(1536),
  p_limit INT DEFAULT 10,
  p_min_score FLOAT DEFAULT 0.0
)
RETURNS TABLE(
  id UUID, content TEXT, metadata JSONB, tags TEXT[], importance INT,
  expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id, m.content, m.metadata, m.tags, m.importance,
    m.expires_at, m.created_at, m.updated_at,
    1 - (m.embedding <=> p_embedding) AS similarity
  FROM memories m
  WHERE m.tenant_id = p_tenant_id
    AND m.embedding IS NOT NULL
    AND 1 - (m.embedding <=> p_embedding) >= p_min_score
  ORDER BY m.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;
