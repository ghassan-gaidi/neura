'use client'

import { useState, useEffect, useCallback } from 'react'

type Memory = { id: string; content: string; tags: string[]; importance: number; created_at: string }
type ApiKey = { id: string; label: string; is_active: boolean; created_at: string; last_used_at: string | null }
type StateEntry = { key: string; value: unknown; updated_at: string }

export default function DashboardPage() {
  const [apiKey, setApiKey] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [memories, setMemories] = useState<Memory[]>([])
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [states, setStates] = useState<StateEntry[]>([])
  const [tab, setTab] = useState<'memories' | 'keys' | 'state'>('memories')
  const [error, setError] = useState('')
  const [newKeyLabel, setNewKeyLabel] = useState('')
  const [newKeyResult, setNewKeyResult] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

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
      const data = await apiFetch('/api/state')
      if (data.data !== undefined) {
        setAuthenticated(true)
        loadData()
      }
    } catch (err: any) {
      setError(err.message || 'Invalid API key')
    } finally {
      setLoading(false)
    }
  }

  const loadData = useCallback(async () => {
    try {
      const [memoriesRes, keysRes, stateRes] = await Promise.all([
        apiFetch('/api/memory?limit=20'),
        apiFetch('/api/webhooks'),  // Re-use webhook list as placeholder for API keys
        apiFetch('/api/state'),
      ])
      setMemories(memoriesRes.data || [])
      setKeys(keysRes.data || [])
      setStates(stateRes.data || [])
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
    }
  }, [apiFetch])

  const handleSearch = async () => {
    if (!searchQuery.trim()) return loadData()
    try {
      const res = await apiFetch(`/api/memory?query=${encodeURIComponent(searchQuery)}&limit=20`)
      setMemories(res.data || [])
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleDeleteMemory = async (id: string) => {
    try {
      await apiFetch(`/api/memory/${id}`, { method: 'DELETE' })
      setMemories((prev) => prev.filter((m) => m.id !== id))
    } catch (err: any) {
      console.error(err)
    }
  }

  const handleCreateKey = async () => {
    setNewKeyResult('')
    try {
      const res = await fetch('/api/admin/keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ label: newKeyLabel || 'dashboard-key' }),
      })
      const data = await res.json()
      if (data.data) {
        setNewKeyResult(`Key created: ${data.data.raw_key}`)
        setNewKeyLabel('')
      }
    } catch (err: any) {
      setNewKeyResult('Error: ' + err.message)
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="w-full max-w-sm px-6">
          <h1 className="text-3xl font-bold mb-2">Neura</h1>
          <p className="text-gray-400 mb-6 text-sm">Enter an API key to access the dashboard.</p>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="sk-..."
            className="w-full bg-gray-900 border border-gray-800 rounded-none px-4 py-3 text-sm mb-4 focus:outline-none focus:border-white"
          />
          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}
          <button
            onClick={login}
            disabled={loading || !apiKey}
            className="w-full bg-white text-black font-bold py-3 text-sm hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? 'Checking...' : 'Access Dashboard'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Neura</h1>
          <div className="flex gap-2 text-sm">
            <button onClick={() => setTab('memories')} className={`px-4 py-2 ${tab === 'memories' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400'} hover:bg-gray-800`}>Memories</button>
            <button onClick={() => setTab('keys')} className={`px-4 py-2 ${tab === 'keys' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400'} hover:bg-gray-800`}>Keys</button>
            <button onClick={() => setTab('state')} className={`px-4 py-2 ${tab === 'state' ? 'bg-white text-black' : 'bg-gray-900 text-gray-400'} hover:bg-gray-800`}>State</button>
          </div>
        </div>

        {tab === 'memories' && (
          <div>
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search memories..."
                className="flex-1 bg-gray-900 border border-gray-800 px-4 py-2 text-sm focus:outline-none focus:border-white"
              />
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
                    <button
                      onClick={() => handleDeleteMemory(m.id)}
                      className="text-gray-600 hover:text-red-400 text-xs shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {memories.length === 0 && <p className="text-gray-500 text-sm">No memories found.</p>}
            </div>
          </div>
        )}

        {tab === 'keys' && (
          <div>
            <div className="bg-gray-900 border border-gray-800 p-4 mb-6">
              <h3 className="font-bold text-sm mb-3">Create New API Key</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Key label (optional)"
                  className="flex-1 bg-black border border-gray-800 px-4 py-2 text-sm focus:outline-none focus:border-white"
                />
                <button onClick={handleCreateKey} className="bg-white text-black px-4 py-2 text-sm font-bold hover:bg-gray-200">Create</button>
              </div>
              {newKeyResult && (
                <p className="mt-3 text-xs font-mono bg-black p-2 break-all">{newKeyResult}</p>
              )}
            </div>
            <div className="space-y-2">
              {keys.map((k) => (
                <div key={k.id} className="bg-gray-900 border border-gray-800 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-mono">{k.label || k.id.slice(0, 8)}...</p>
                    <p className="text-xs text-gray-500">Created {new Date(k.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 ${k.is_active ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {k.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'state' && (
          <div>
            <div className="space-y-2">
              {states.map((s) => (
                <div key={s.key} className="bg-gray-900 border border-gray-800 p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-mono font-bold">{s.key}</p>
                      <pre className="text-xs text-gray-400 mt-1">{JSON.stringify(s.value, null, 2)}</pre>
                    </div>
                    <span className="text-xs text-gray-500">{new Date(s.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
              {states.length === 0 && <p className="text-gray-500 text-sm">No state entries.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
