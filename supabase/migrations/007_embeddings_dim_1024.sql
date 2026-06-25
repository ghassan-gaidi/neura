-- Migrate embeddings from 1536-dim (OpenAI) to 1024-dim (Voyage AI).
-- Step 1: drop the HNSW index (depends on vector type)
DROP INDEX IF EXISTS idx_memories_embedding;

-- Step 2: re-cast existing embeddings (truncate 1536 → 1024).
--         This preserves existing data; vectors longer than 1024 are truncated.
ALTER TABLE memories
  ALTER COLUMN embedding TYPE extensions.vector(1024)
  USING embedding::extensions.vector(1024);

-- Step 3: drop & recreate search_memories RPC with new signature
DROP FUNCTION IF EXISTS search_memories;

CREATE OR REPLACE FUNCTION search_memories(
  p_tenant_id UUID,
  p_embedding extensions.vector(1024),
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

-- Step 4: recreate the HNSW index
SET search_path TO public, extensions;
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
SET search_path TO public;
