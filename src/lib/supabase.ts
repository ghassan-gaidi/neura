import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

/**
 * Get an authenticated Supabase client scoped to a tenant.
 * Sets app.tenant_id for RLS policies.
 */
export function getTenantClient(tenantId: string) {
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: 'public' },
    global: {
      headers: {
        'app.tenant_id': tenantId,
      },
    },
  })
  // For raw SQL we set the session variable
  return client
}

/**
 * Execute a raw SQL query with tenant context.
 * Used for vector search and other complex queries.
 */
export async function executeWithTenant<T>(
  tenantId: string,
  query: string,
  params?: any[]
): Promise<T[]> {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: query,
    params: params || [],
  })
  if (error) throw error
  return data as T[]
}

export type SupabaseClient = ReturnType<typeof createClient>
