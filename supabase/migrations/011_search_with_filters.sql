-- Vector search that applies filters BEFORE the LIMIT, so filtered-out rows
-- do not consume result slots.
CREATE OR REPLACE FUNCTION search_memories_filtered(
  p_tenant_id UUID,
  p_embedding extensions.vector(1024),
  p_limit INT DEFAULT 10,
  p_min_score FLOAT DEFAULT 0.0,
  p_tags TEXT[] DEFAULT NULL,
  p_importance_min INT DEFAULT NULL,
  p_importance_max INT DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  id UUID, content TEXT, metadata JSONB, tags TEXT[], importance INT,
  expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
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
    AND (p_tags IS NULL OR m.tags && p_tags)
    AND (p_importance_min IS NULL OR m.importance >= p_importance_min)
    AND (p_importance_max IS NULL OR m.importance <= p_importance_max)
    AND (p_date_from IS NULL OR m.created_at >= p_date_from)
    AND (p_date_to IS NULL OR m.created_at <= p_date_to)
  ORDER BY m.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;
