import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-24">
        {/* Hero */}
        <header className="mb-24">
          <h1 className="text-6xl font-bold tracking-tight mb-4">Neura</h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl">
            An external brain for AI agents. Persistent memory and state 
            via HTTP. Semantic search. Autonomous payments.
          </p>
          <div className="flex gap-3">
            <a href="/docs" className="bg-white text-black px-6 py-3 text-sm font-bold hover:bg-gray-200">API Docs</a>
            <a href="/dashboard" className="bg-gray-900 text-gray-300 px-6 py-3 text-sm font-bold hover:bg-gray-800 border border-gray-800">Dashboard</a>
            <a href="https://github.com/ghassan-gaidi/neura" className="bg-gray-900 text-gray-300 px-6 py-3 text-sm font-bold hover:bg-gray-800 border border-gray-800">GitHub</a>
          </div>
        </header>

        {/* How it works */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-8">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-gray-800 p-6">
              <p className="text-3xl font-bold mb-2">1.</p>
              <p className="font-bold mb-2">Store</p>
              <p className="text-sm text-gray-500">Agents send facts via HTTP. Auto-embedded for semantic search.</p>
            </div>
            <div className="border border-gray-800 p-6">
              <p className="text-3xl font-bold mb-2">2.</p>
              <p className="font-bold mb-2">Recall</p>
              <p className="text-sm text-gray-500">Natural language queries return relevant memories with scores.</p>
            </div>
            <div className="border border-gray-800 p-6">
              <p className="text-3xl font-bold mb-2">3.</p>
              <p className="font-bold mb-2">Persist</p>
              <p className="text-sm text-gray-500">Key-value state survives context loss. Webhooks for events.</p>
            </div>
          </div>
        </section>

        {/* Code Example */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-4">A single line</h2>
          <pre className="bg-gray-900 border border-gray-800 p-6 text-sm font-mono overflow-x-auto">{`import { Neura } from 'neura'

const neura = new Neura({ apiKey: 'sk-...' })

// Remember
await neura.memory.create({ content: 'User prefers dark mode' })

// Recall
const results = await neura.memory.search('UI preferences')`}</pre>
        </section>

        {/* Pricing */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-4">Pricing</h2>
          <div className="border border-gray-800 p-6">
            <p className="text-sm text-gray-400 mb-4">1000 free credits on signup. Then $1 USDC per 1000 credits.</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-gray-500">Store</span><br/>1 credit</div>
              <div><span className="text-gray-500">Search</span><br/>1 credit</div>
              <div><span className="text-gray-500">Advanced</span><br/>2 credits</div>
              <div><span className="text-gray-500">Summarize</span><br/>5 credits</div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-8">Everything included</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            {[
              'Semantic vector search (pgvector + HNSW)',
              'Auto-embedding via OpenAI',
              'Key-value state management',
              'Rate limiting (configurable)',
              'Idempotency keys for safe retries',
              'Webhook notifications',
              'Cross-agent memory sharing',
              'Memory summarization',
              'TypeScript + Python SDKs',
              'Autonomous USDC payments (x402)',
              'OpenAPI 3.1 spec',
              'Dashboard for humans',
            ].map((f) => (
              <div key={f} className="border border-gray-900 p-3 text-gray-300">{f}</div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-gray-900 pt-8 text-sm text-gray-600">
          <div className="flex gap-6">
            <a href="/docs" className="hover:text-white">Docs</a>
            <a href="/openapi.yaml" className="hover:text-white">OpenAPI</a>
            <a href="https://github.com/ghassan-gaidi/neura" className="hover:text-white">GitHub</a>
            <span className="ml-auto">Neura — external brain for AI agents</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
