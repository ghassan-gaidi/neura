'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

type Memory = { id: string; content: string; tags: string[]; importance: number; created_at: string }
type Transaction = { id: string; amount: number; transaction_type: string; description: string; created_at: string }
type Usage = { total_requests: number; credits_used: number; credits_purchased: number; by_endpoint: Record<string, number>; by_day: Record<string, number> }
type StateEntry = { key: string; value: any; created_at: string; updated_at: string }
type ApiKeyEntry = { id: string; label: string; is_active: boolean; created_at: string; last_used_at: string | null }

type Tab = 'usage' | 'billing' | 'memories' | 'keys' | 'state'

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-black p-6 border border-white/5">
      <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>{value.toLocaleString()}</p>
      <p className="text-xs text-white/30 mt-1">{label}</p>
    </div>
  )
}

export default function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [apiKey, setApiKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(false)
  const [dataLoading, setDataLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('usage')
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')

  // Data
  const [memories, setMemories] = useState<Memory[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [balance, setBalance] = useState(0)
  const [stateEntries, setStateEntries] = useState<StateEntry[]>([])
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([])

  // Controls
  const [searchQuery, setSearchQuery] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyResult, setNewKeyResult] = useState('')
  const [topUpAmount, setTopUpAmount] = useState('1000')
  const [topUpResult, setTopUpResult] = useState('')

  // Auto-detect Supabase Auth session on mount
  useEffect(() => {
    const initAuth = async () => {
      // Check for key in URL params first (from auth callback)
      const urlKey = searchParams.get('key')
      if (urlKey) {
        setApiKey(urlKey)
        localStorage.setItem('neura_api_key', urlKey)
        return
      }

      // Check localStorage
      const storedKey = localStorage.getItem('neura_api_key')
      if (storedKey) {
        setApiKey(storedKey)
        return
      }

      // Check Supabase Auth session
      const { data: { session } } = await supabaseBrowser.auth.getSession()
      if (session) {
        setUserEmail(session.user.email || '')
        // Fetch API key from our backend
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
          if (res.ok) {
            const result = await res.json()
            if (result.data?.api_key) {
              // We need the raw key — but /api/auth/me only returns metadata
              // Show a prompt to get the key from the user
              setError('Signed in as ' + session.user.email + '. Enter your API key to continue.')
            }
          }
        } catch {}
      }
    }
    initAuth()
  }, [searchParams])

  const apiFetch = useCallback(async (path: string, options?: RequestInit) => {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: res.statusText } }))
      throw new Error(err.error?.message || 'Request failed')
    }
    return res.json()
  }, [apiKey])

  const login = async () => {
    setAuthLoading(true)
    setError('')
    try {
      await apiFetch('/api/state')
      setAuthenticated(true)
      localStorage.setItem('neura_api_key', apiKey)
    } catch (err: any) {
      setError(err.message || 'Invalid API key')
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = async () => {
    await supabaseBrowser.auth.signOut()
    localStorage.removeItem('neura_api_key')
    setApiKey('')
    setAuthenticated(false)
    setUserEmail('')
  }

  const loadData = useCallback(async () => {
    setDataLoading(true)
    try {
      const [memRes, txRes, usageRes, creditRes, stateRes, keysRes] = await Promise.all([
        apiFetch('/api/memory?limit=15'),
        apiFetch('/api/admin/transactions?limit=20'),
        apiFetch('/api/admin/usage?days=7'),
        apiFetch('/api/credits'),
        apiFetch('/api/state'),
        apiFetch('/api/admin/keys'),
      ])
      setMemories(memRes.data || [])
      setTransactions(txRes.data || [])
      setUsage(usageRes.data || null)
      setBalance(creditRes.data?.balance || 0)
      setStateEntries(stateRes.data || [])
      setApiKeys(keysRes.data || [])
    } catch (err: any) {
      console.error('Load error:', err)
    } finally {
      setDataLoading(false)
    }
  }, [apiFetch])

  // Auto-login when apiKey is set
  useEffect(() => {
    if (apiKey && !authenticated) {
      login()
    }
  }, [apiKey])

  useEffect(() => { if (authenticated) loadData() }, [authenticated, loadData])

  const handleSearch = async () => {
    setDataLoading(true)
    if (!searchQuery.trim()) {
      await loadData()
      setDataLoading(false)
      return
    }
    try {
      const res = await apiFetch(`/api/memory?query=${encodeURIComponent(searchQuery)}&limit=15`)
      setMemories(res.data || [])
    } catch { await loadData() }
    setDataLoading(false)
  }

  const handleDeleteMemory = async (id: string) => {
    await apiFetch(`/api/memory/${id}`, { method: 'DELETE' })
    setMemories((p) => p.filter((m) => m.id !== id))
  }

  const handleTopUp = async () => {
    setTopUpResult('Processing...')
    try {
      const res = await apiFetch('/api/credits/top-up', {
        method: 'POST',
        body: JSON.stringify({ test_top_up: true, credits: parseInt(topUpAmount) }),
      })
      setTopUpResult(`+${res.data.credits_added} credits added. New balance: ${res.data.balance}`)
      setBalance(res.data.balance)
      await loadData()
    } catch (err: any) { setTopUpResult('Error: ' + err.message) }
  }

  // Auth screen
  if (!authenticated) {
    return (
      <div className="relative z-10 flex items-center justify-center min-h-[calc(100vh-3rem)]">
        <div className="w-full max-w-sm px-6">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'var(--font-syne)' }}>Neura</h1>
          <p className="text-white/60 text-sm mb-6">
            {userEmail
              ? `Signed in as ${userEmail}. Enter your API key.`
              : 'Enter an API key to access the dashboard.'}
          </p>

          {!userEmail && (
            <a
              href="/signup"
              className="block w-full text-center bg-white/5 border-2 border-white/20 text-white px-4 py-3 text-sm font-bold mb-4 hover:bg-white/10 transition-colors"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Sign up for free →
            </a>
          )}

          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="sk-..."
            className="w-full bg-black border-2 border-white/20 px-4 py-3 text-sm mb-4 focus:outline-none focus:border-white"
          />
          {error && <p className="text-white/60 text-sm mb-4 border-2 border-white/10 bg-white/5 px-4 py-2">{error}</p>}
          <button
            onClick={login}
            disabled={authLoading || !apiKey}
            className="w-full bg-white text-black font-bold py-3 text-sm border-2 border-white disabled:opacity-30 hover:bg-white/80 transition-colors"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            {authLoading ? 'Checking...' : 'Access Dashboard'}
          </button>

          {userEmail && (
            <button
              onClick={logout}
              className="w-full mt-3 text-white/30 text-xs hover:text-white transition-colors"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
    )
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'usage', label: 'Usage' },
    { id: 'billing', label: 'Billing' },
    { id: 'memories', label: 'Memories' },
    { id: 'keys', label: 'Keys' },
    { id: 'state', label: 'State' },
  ]

  return (
    <div className="relative z-10">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b-2 border-white/10 pb-4">
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>Dashboard</h1>
            <p className="text-xs text-white/50">{balance.toLocaleString()} credits remaining</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 text-xs font-bold border-2 ${
                    tab === t.id
                      ? 'bg-white text-black border-white'
                      : 'bg-black text-white/30 border-white/10 hover:text-white hover:border-white/30'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              onClick={logout}
              className="text-white/20 hover:text-white text-xs border border-white/10 px-3 py-2"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Loading overlay */}
        {dataLoading && (
          <div className="mb-6 border-2 border-white/10 bg-white/5 px-4 py-2 text-xs text-white/40">
            Loading...
          </div>
        )}

        {/* Usage Tab */}
        {tab === 'usage' && usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 mb-8">
            <StatBox label="Requests (7 days)" value={usage.total_requests} />
            <StatBox label="Credits consumed" value={usage.credits_used} />
            <StatBox label="Credits purchased" value={usage.credits_purchased} />
            <div className="md:col-span-3 bg-black p-6 border border-white/5">
              <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Requests by Endpoint</p>
              <div className="space-y-2">
                {Object.entries(usage.by_endpoint)
                  .sort((a, b) => b[1] - a[1])
                  .map(([ep, count]) => {
                    const maxVal = Math.max(...Object.values(usage.by_endpoint))
                    return (
                      <div key={ep} className="flex items-center gap-3">
                        <span className="text-xs text-white/40 w-40 truncate">{ep}</span>
                        <div className="flex-1 bg-white/5 h-4 border border-white/10">
                          <div
                            className="bg-white h-full"
                            style={{ width: `${(count / maxVal) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-white/30 w-16 text-right">{count}</span>
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>
        )}
        {tab === 'usage' && !usage && !dataLoading && (
          <p className="text-white/30 text-sm">No usage data available.</p>
        )}

        {/* Billing Tab */}
        {tab === 'billing' && (
          <div>
            {/* Top Up */}
            <div className="border-2 border-white/10 bg-white/[0.02] p-6 mb-8">
              <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Top Up Credits (test mode)</p>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  className="bg-black border-2 border-white/20 px-4 py-2 text-sm w-32 focus:outline-none focus:border-white"
                />
                <button
                  onClick={handleTopUp}
                  className="bg-white text-black px-4 py-2 text-sm font-bold border-2 border-white hover:bg-white/80 transition-colors"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  Add Test Credits
                </button>
              </div>
              {topUpResult && (
                <p className="mt-3 text-xs text-white/40">{topUpResult}</p>
              )}
              <p className="mt-4 text-xs text-white/20">
                In production, agents send USDC on Base and call POST /api/payments/verify
              </p>
            </div>

            {/* Transactions */}
            <p className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>Transaction History</p>
            <div className="space-y-px">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-white/[0.02] border border-white/5 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs px-2 py-1 font-bold ${
                        tx.transaction_type === 'spend'
                          ? 'bg-white/10 text-white/60'
                          : tx.transaction_type === 'purchase'
                          ? 'bg-white/20 text-white'
                          : 'bg-white/5 text-white/30'
                      }`}
                    >
                      {tx.transaction_type}
                    </span>
                    <span className="text-xs text-white/30">{tx.description || '-'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-bold ${tx.amount > 0 ? 'text-white' : 'text-white/40'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                    <span className="text-xs text-white/20">{new Date(tx.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-white/30 text-sm">No transactions yet.</p>}
            </div>
          </div>
        )}

        {/* Memories Tab */}
        {tab === 'memories' && (
          <div>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories..."
                className="flex-1 bg-black border-2 border-white/20 px-4 py-2 text-sm focus:outline-none focus:border-white"
              />
              <button
                onClick={handleSearch}
                className="bg-white text-black px-4 py-2 text-sm font-bold border-2 border-white hover:bg-white/80 transition-colors"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Search
              </button>
              <button
                onClick={loadData}
                className="bg-black text-white/40 px-4 py-2 text-sm border-2 border-white/10 hover:text-white hover:border-white/30 transition-colors"
              >
                Recent
              </button>
            </div>
            <div className="space-y-px">
              {memories.map((m) => (
                <div key={m.id} className="bg-white/[0.02] border border-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{m.content}</p>
                      <div className="flex gap-2 mt-2 text-xs text-white/30">
                        {m.tags?.map((t) => (
                          <span key={t} className="border border-white/10 px-2 py-0.5">{t}</span>
                        ))}
                        <span>Importance: {m.importance}/10</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-white/20 hover:text-white/60 text-xs shrink-0 border border-white/10 px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {memories.length === 0 && <p className="text-white/30 text-sm">No memories found.</p>}
            </div>
          </div>
        )}

        {/* Keys Tab */}
        {tab === 'keys' && (
          <div>
            {/* Create new key */}
            <div className="border-2 border-white/10 bg-white/[0.02] p-6 mb-8">
              <p className="text-sm font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>Create New API Key</p>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Key label (e.g. production, staging, dev)"
                  className="flex-1 bg-black border-2 border-white/20 px-4 py-2 text-sm focus:outline-none focus:border-white"
                />
                <button
                  onClick={async () => {
                    setNewKeyResult('')
                    try {
                      const res = await apiFetch('/api/admin/keys', {
                        method: 'POST',
                        body: JSON.stringify({ label: newKeyLabel || `key-${Date.now()}` }),
                      })
                      setNewKeyResult(res.data?.raw_key || '')
                      setNewKeyLabel('')
                      await loadData()
                    } catch (err: any) {
                      setNewKeyResult('Error: ' + err.message)
                    }
                  }}
                  className="bg-white text-black px-4 py-2 text-sm font-bold border-2 border-white hover:bg-white/80 transition-colors"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  Create
                </button>
              </div>
              {newKeyResult && (
                <div className="mt-3">
                  <p className="text-xs text-white/40 mb-1">Copy this key now — it won't be shown again:</p>
                  <p className="text-xs bg-black border border-white/10 p-2 break-all select-all font-mono">
                    {newKeyResult}
                  </p>
                </div>
              )}
            </div>

            {/* Key list */}
            <p className="text-sm font-bold mb-3" style={{ fontFamily: 'var(--font-syne)' }}>
              API Keys ({apiKeys.length})
            </p>
            <div className="space-y-px">
              {apiKeys.map((k) => (
                <div key={k.id} className="bg-white/[0.02] border border-white/5 p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          k.is_active ? 'bg-green-500' : 'bg-red-500/50'
                        }`}
                      />
                      <p className="text-sm font-bold truncate" style={{ fontFamily: 'var(--font-syne)' }}>
                        {k.label}
                      </p>
                      <span className={`text-xs px-2 py-0.5 ${
                        k.is_active
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400/50 border border-red-500/20'
                      }`}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-white/30">
                      <span>Created: {new Date(k.created_at).toLocaleDateString()}</span>
                      <span>ID: {k.id.substring(0, 8)}...</span>
                      {k.last_used_at && <span>Last used: {new Date(k.last_used_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {k.is_active && (
                    <button
                      onClick={async () => {
                        if (!confirm(`Revoke key "${k.label}"? This cannot be undone.`)) return
                        try {
                          await apiFetch(`/api/admin/keys/${k.id}`, { method: 'DELETE' })
                          await loadData()
                        } catch (err: any) {
                          alert('Failed to revoke: ' + err.message)
                        }
                      }}
                      className="text-white/30 hover:text-red-400 text-xs border border-white/10 hover:border-red-400/30 px-3 py-1.5 transition-colors ml-4 shrink-0"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              ))}
              {apiKeys.length === 0 && (
                <p className="text-white/30 text-sm border border-white/5 p-4">No API keys yet.</p>
              )}
            </div>
          </div>
        )}

        {/* State Tab */}
        {tab === 'state' && (
          <div>
            {stateEntries.length > 0 ? (
              <div className="space-y-px">
                {stateEntries.map((entry) => (
                  <div key={entry.key} className="bg-white/[0.02] border border-white/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold" style={{ fontFamily: 'var(--font-syne)' }}>{entry.key}</p>
                        <pre className="text-xs text-white/40 mt-1 overflow-x-auto">
                          {typeof entry.value === 'object' ? JSON.stringify(entry.value, null, 2) : String(entry.value)}
                        </pre>
                      </div>
                      <span className="text-xs text-white/20 shrink-0">{new Date(entry.updated_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm">No state entries found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
