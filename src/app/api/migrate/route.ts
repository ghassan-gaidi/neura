import { NextRequest, NextResponse } from 'next/server'

const MIGRATE_KEY = process.env.NEURA_MIGRATE_KEY
if (!MIGRATE_KEY) {
  console.warn('[migrate] NEURA_MIGRATE_KEY not set — endpoint disabled')
}

export async function POST(req: NextRequest) {
  // Hard-fail if no migration key configured
  if (!MIGRATE_KEY) {
    return NextResponse.json({ error: 'migration endpoint disabled' }, { status: 503 })
  }

  const provided = req.headers.get('x-migration-key')
  if (provided !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const sql = body.sql || ''

  if (!sql || typeof sql !== 'string') {
    return NextResponse.json({ error: 'sql field required' }, { status: 400 })
  }

  // Block dangerous SQL patterns
  const blocked = /\b(DROP\s+DATABASE|TRUNCATE|pg_|COPY\s+.*FROM\s+PROGRAM)\b/i
  if (blocked.test(sql)) {
    return NextResponse.json({ error: 'blocked SQL pattern' }, { status: 400 })
  }

  const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || ''
  if (!DB_PASSWORD) {
    return NextResponse.json({ error: 'SUPABASE_DB_PASSWORD not configured' }, { status: 500 })
  }

  try {
    const { default: { Pool } } = await import('pg')
    const pool = new Pool({
      host: 'aws-0-eu-west-1.pooler.supabase.com', port: 6543,
      user: 'postgres.hykistvnlfhiywuifcak',
      password: DB_PASSWORD, database: 'postgres',
      max: 1, idleTimeoutMillis: 15000,
      ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000,
    })
    await pool.query(sql)
    await pool.end()
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Neura migrate' })
}
