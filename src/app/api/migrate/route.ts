import { NextRequest, NextResponse } from 'next/server'

/**
 * One-shot migration: change embedding column from vector(1536) → vector(1024).
 * Run once via: curl -X POST https://neura-blond.vercel.app/api/migrate
 *   -H "x-migration-key: <NEURA_MIGRATE_KEY>"
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY + NEURA_MIGRATE_KEY in Vercel env.
 * This endpoint can be safely removed after the migration is confirmed.
 */

const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const MIGRATE_KEY = process.env.NEURA_MIGRATE_KEY

const SQL = `
  -- Step 1: drop HNSW index
  DROP INDEX IF EXISTS idx_memories_embedding;

  -- Step 2: re-cast existing embeddings 1536 → 1024
  ALTER TABLE memories
    ALTER COLUMN embedding TYPE extensions.vector(1024)
    USING embedding::extensions.vector(1024);

  -- Step 3: drop & recreate search_memories RPC
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

  -- Step 4: recreate HNSW index
  SET search_path TO public, extensions;
  CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
  SET search_path TO public;
`

export async function POST(request: NextRequest) {
  // Auth
  const provided = request.headers.get('x-migration-key')
  if (!MIGRATE_KEY || provided !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  if (!SERVICE_ROLE_KEY || !SUPABASE_URL) {
    return NextResponse.json(
      { error: 'Supabase not configured' },
      { status: 500 },
    )
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/pg/v1/sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: SQL }),
    })

    const data = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: data }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
      { status: 500 },
    )
  }
}
