'use client'

import { useState, useEffect, useCallback } from 'react'

type Memory = { id: string; content: string; tags: string[]; importance: number; created_at: string }
type Transaction = { id: string; amount: number; transaction_type: string; description: string; created_at: string }
type Usage = { total_requests: number; credits_used: number; credits_purchased: number; by_endpoint: Record<string, number>; by_day: Record<string, number> }

type Tab = 'memories' | 'keys' | 'state' | 'billing' | 'usage'

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('usage')
  const [error, setError] = useState('')

  // Data
  const [memories, setMemories] = useState<Memory[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [balance, setBalance] = useState(0)

  // Controls
  const [searchQuery, setSearchQuery] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyResult, setNewKeyResult] = useState('')
  const [topUpAmount, setTopUpAmount] = useState('1000')
  const [topUpResult, setTopUpResult] = useState('')

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
    setLoading(true)
    setError('')
    try {
      await apiFetch('/api/state')
      setAuthenticated(true)
    } catch (err: any) {
      setError(err.message || 'Invalid API key')
    } finally {
      setLoading(false)
    }
  }

  const loadData = useCallback(async () => {
    try {
      const [memRes, txRes, usageRes, creditRes] = await Promise.all([
        apiFetch('/api/memory?limit=15'),
        apiFetch('/api/admin/transactions?limit=20'),
        apiFetch('/api/admin/usage?days=7'),
        apiFetch('/api/credits'),
      ])
      setMemories(memRes.data || [])
      setTransactions(txRes.data || [])
      setUsage(usageRes.data || null)
      setBalance(creditRes.data?.balance || 0)
    } catch (err: any) {
      console.error('Load error:', err)
    }
  }, [apiFetch])

  useEffect(() => { if (authenticated) loadData() }, [authenticated, loadData])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return loadData()
    try {
      const res = await apiFetch(`/api/memory?query=${encodeURIComponent(searchQuery)}&limit=15`)
      setMemories(res.data || [])
    } catch { loadData() }
  }

  const handleDeleteMemory = async (id: string) => {
    await apiFetch(`/api/memory/${id}`, { method: 'DELETE' })
    setMemories((p) => p.filter((m) => m.id !== id))
  }

  const handleCreateKey = async () => {
    setNewKeyResult('')
    try {
      const res = await apiFetch('/api/admin/keys', {
        method: 'POST',
        body: JSON.stringify({ label: newKeyLabel || 'dashboard-key' }),
      })
      setNewKeyResult(res.data.raw_key)
      setNewKeyLabel('')
    } catch (err: any) { setNewKeyResult('Error: ' + err.message) }
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
      loadData()
    } catch (err: any) { setTopUpResult('Error: ' + err.message) }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-full max-w-sm px-6">
          <h1 className="text-3xl font-bold mb-2">Neura</h1>
          <p className="text-gray-500 mb-6 text-sm">Enter an API key to access the dashboard.</p>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="sk-..." className="w-full bg-gray-900 border border-gray-800 px-4 py-3 text-sm mb-4 focus:outline-none focus:border-white" />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button onClick={login} disabled={loading || !apiKey}
            className="w-full bg-white text-black font-bold py-3 text-sm hover:bg-gray-200 disabled:opacity-50">
            {loading ? 'Checking...' : 'Access Dashboard'}
          </button>
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
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 border-b border-gray-900 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Neura</h1>
            <p className="text-sm text-gray-500">{balance.toLocaleString()} credits remaining</p>
          </div>
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-2 text-sm ${tab === t.id ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Usage Tab */}
        {tab === 'usage' && usage && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 p-5">
              <p className="text-3xl font-bold">{usage.total_requests}</p>
              <p className="text-xs text-gray-500 mt-1">Requests (7 days)</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-5">
              <p className="text-3xl font-bold">{usage.credits_used}</p>
              <p className="text-xs text-gray-500 mt-1">Credits consumed</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 p-5">
              <p className="text-3xl font-bold">{usage.credits_purchased}</p>
              <p className="text-xs text-gray-500 mt-1">Credits purchased</p>
            </div>
            <div className="md:col-span-3 bg-gray-900 border border-gray-800 p-5">
              <p className="text-sm font-bold mb-3">Requests by Endpoint</p>
              <div className="space-y-2">
                {Object.entries(usage.by_endpoint).sort((a, b) => b[1] - a[1]).map(([ep, count]) => (
                  <div key={ep} className="flex items-center gap-3">
                    <span className="text-xs font-mono text-gray-400 w-40 truncate">{ep}</span>
                    <div className="flex-1 bg-gray-800 h-4">
                      <div className="bg-white h-4" style={{ width: `${Math.min((count / Math.max(...Object.values(usage.by_endpoint))) * 100, 100)}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-16 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {tab === 'billing' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 p-5 mb-6">
              <p className="text-sm font-bold mb-3">Top Up Credits</p>
              <div className="flex gap-2">
                <input type="number" value={topUpAmount} onChange={(e) => setTopUpAmount(e.target.value)}
                  className="bg-black border border-gray-800 px-4 py-2 text-sm w-32 focus:outline-none focus:border-white" />
                <button onClick={handleTopUp} className="bg-white text-black px-4 py-2 text-sm font-bold hover:bg-gray-200">
                  Add Test Credits
                </button>
              </div>
              {topUpResult && <p className="mt-2 text-xs text-gray-400">{topUpResult}</p>}
              <p className="mt-3 text-xs text-gray-600">In production, agents send USDC on Base and call POST /api/payments/verify</p>
            </div>

            <p className="text-sm font-bold mb-3">Transaction History</p>
            <div className="space-y-1">
              {transactions.map((tx) => (
                <div key={tx.id} className="bg-gray-900 border border-gray-800 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 font-mono ${
                      tx.transaction_type === 'spend' ? 'bg-red-900 text-red-300' :
                      tx.transaction_type === 'purchase' ? 'bg-green-900 text-green-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>{tx.transaction_type}</span>
                    <span className="text-xs text-gray-400">{tx.description || '-'}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </span>
                    <span className="text-xs text-gray-600">{new Date(tx.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && <p className="text-gray-500 text-sm">No transactions yet.</p>}
            </div>
          </div>
        )}

        {/* Memories Tab */}
        {tab === 'memories' && (
          <div>
            <div className="flex gap-2 mb-6">
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories..." className="flex-1 bg-gray-900 border border-gray-800 px-4 py-2 text-sm focus:outline-none focus:border-white" />
              <button onClick={handleSearch} className="bg-white text-black px-4 py-2 text-sm font-bold hover:bg-gray-200">Search</button>
              <button onClick={loadData} className="bg-gray-900 text-gray-400 px-4 py-2 text-sm hover:bg-gray-800">Recent</button>
            </div>
            <div className="space-y-3">
              {memories.map((m) => (
                <div key={m.id} className="bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{m.content}</p>
                      <div className="flex gap-2 mt-2 text-xs text-gray-500">
                        {m.tags?.map((t) => <span key={t} className="bg-gray-800 px-2 py-0.5">{t}</span>)}
                        <span>Importance: {m.importance}/10</span>
                        <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteMemory(m.id)} className="text-gray-600 hover:text-red-400 text-xs shrink-0">Delete</button>
                  </div>
                </div>
              ))}
              {memories.length === 0 && <p className="text-gray-500 text-sm">No memories found.</p>}
            </div>
          </div>
        )}

        {/* Keys Tab */}
        {tab === 'keys' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 p-4 mb-6">
              <p className="text-sm font-bold mb-3">Create New API Key</p>
              <div className="flex gap-2">
                <input type="text" value={newKeyLabel} onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Key label" className="flex-1 bg-black border border-gray-800 px-4 py-2 text-sm focus:outline-none focus:border-white" />
                <button onClick={handleCreateKey} className="bg-white text-black px-4 py-2 text-sm font-bold hover:bg-gray-200">Create</button>
              </div>
              {newKeyResult && <p className="mt-3 text-xs font-mono bg-black p-2 break-all select-all">{newKeyResult}</p>}
            </div>
          </div>
        )}

        {/* State Tab */}
        {tab === 'state' && <p className="text-gray-500 text-sm">State tab — loaded from API.</p>}
      </div>
    </div>
  )
}
