import { NextRequest, NextResponse } from 'next/server'

/**
 * One-shot migration: change embedding column from vector(1536) → vector(1024).
 * Run once via: curl -X POST https://neura-blond.vercel.app/api/migrate \
 *   -H "x-migration-key: <your-key>" -H "Content-Type: application/json"
 *
 * Uses pg (node-postgres) directly via Supabase connection pooler,
 * authenticating with the JWT service_role key as the password.
 */

const MIGRATE_KEY = process.env.NEURA_MIGRATE_KEY || 'migrate-neura-2024'

const SQL_STATEMENTS = [
  `DROP INDEX IF EXISTS idx_memories_embedding`,
  `ALTER TABLE memories
    ALTER COLUMN embedding TYPE extensions.vector(1024)
    USING embedding::extensions.vector(1024)`,
  `DROP FUNCTION IF EXISTS search_memories`,
  `CREATE OR REPLACE FUNCTION search_memories(
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
    SELECT m.id, m.content, m.metadata, m.tags, m.importance,
           m.expires_at, m.created_at, m.updated_at,
           1 - (m.embedding <=> p_embedding) AS similarity
    FROM memories m
    WHERE m.tenant_id = p_tenant_id
      AND m.embedding IS NOT NULL
      AND 1 - (m.embedding <=> p_embedding) >= p_min_score
    ORDER BY m.embedding <=> p_embedding
    LIMIT p_limit;
  END;
  $$`,
  `SET search_path TO public, extensions`,
  `CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories
    USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200)`,
  `SET search_path TO public`,
]

export async function POST(req: NextRequest) {
  // Auth check
  const provided = req.headers.get('x-migration-key')
  if (provided !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)/)?.[1] || 'hykistvnlfhiywuifcak'
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const region = 'us-east-1'

    if (!serviceRoleKey) {
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not available' }, { status: 500 })
    }

    // Try connecting via Supabase pooler using JWT as password
    // Format: postgresql://postgres.<ref>@<region>.pooler.supabase.com:6543/postgres
    const connectionString = `postgresql://postgres.${projectRef}:${encodeURIComponent(serviceRoleKey)}@aws-0-${region}.pooler.supabase.com:6543/postgres`

    // Dynamic import of pg
    const { default: { Pool } } = await import('pg')

    const pool = new Pool({ connectionString, max: 1, idleTimeoutMillis: 5000 })

    const results: string[] = []

    for (const sql of SQL_STATEMENTS) {
      try {
        await pool.query(sql)
        results.push(`✓ ${sql.substring(0, 80)}...`)
      } catch (err: any) {
        results.push(`✗ ${sql.substring(0, 80)}... -> ${err.message}`)
        // Don't fail on SET search_path non-errors
        if (!sql.startsWith('SET search_path')) {
          await pool.end()
          return NextResponse.json({ results, error: err.message, sql: sql.substring(0, 200) }, { status: 500 })
        }
      }
    }

    await pool.end()
    return NextResponse.json({ success: true, results })
  } catch (err: any) {
    // Fallback: try direct db connection
    try {
      const { default: { Pool } } = await import('pg')
      const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https?:\/\/([^.]+)/)?.[1] || 'hykistvnlfhiywuifcak'
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

      // Try direct connection
      const directConn = `postgresql://postgres.${projectRef}:${encodeURIComponent(serviceRoleKey || '')}@db.${projectRef}.supabase.co:5432/postgres`
      const pool = new Pool({ connectionString: directConn, max: 1, idleTimeoutMillis: 5000 })
      const result = await pool.query('SELECT 1 AS ok')
      await pool.end()
      return NextResponse.json({ message: 'db accessible via direct', result: result.rows, note: 'but migration SQL not attempted' })
    } catch (fallbackErr: any) {
      return NextResponse.json({
        error: err.message,
        fallback: fallbackErr.message,
        hint: 'The service_role key approach to direct DB access failed. Run the migration SQL manually in the Supabase dashboard SQL Editor.'
      }, { status: 500 })
    }
  }
}
