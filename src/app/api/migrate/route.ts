import { NextRequest, NextResponse } from 'next/server'

const MIGRATE_KEY = process.env.NEURA_MIGRATE_KEY || 'migrate-neura-2024'
const DB_PASSWORD = process.env.SUPABASE_DB_PASSWORD || ''

export async function POST(req: NextRequest) {
  const provided = req.headers.get('x-migration-key')
  if (provided !== MIGRATE_KEY) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const sql = body.sql || ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

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

    // If the SQL was a function fix, test signup
    if (sql.includes('handle_new_user') || sql.includes('create_user_api_key')) {
      const testEmail = `test-${Date.now()}@neura-test.io`
      const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'apikey': serviceRoleKey, 'Authorization': `Bearer ${serviceRoleKey}` },
        body: JSON.stringify({ email: testEmail, password: 'TestPass123!', email_confirm: true }),
      })
      const data = await res.json()
      return NextResponse.json({ sql_ok: true, signup_test: { status: res.status, body: data, email: testEmail } })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Neura migrate' })
}
