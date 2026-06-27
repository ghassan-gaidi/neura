import Link from 'next/link'

const codeExample = `import { Neura } from 'neura-api'

const neura = new Neura({ apiKey: 'sk-...' })

// Remember
await neura.memory.create({ content: 'User prefers dark mode' })

// Recall
const results = await neura.memory.search('UI preferences')`

const pythonExample = `from neura import Neura

neura = Neura(api_key="sk-...")

# Store
neura.memory.create(content="User prefers dark mode")

# Search
results = neura.memory.search("UI preferences")`

const features = [
  {
    title: 'Memory',
    items: ['Auto-embedding via Voyage AI', 'Semantic search with scoring', 'Batch create (25/batch)', 'TTL expiration', 'Agent-to-agent sharing'],
  },
  {
    title: 'State',
    items: ['Key-value persistence', 'Survives context loss', 'JSON-serializable values', 'Instant reads/writes', 'No schema needed'],
  },
  {
    title: 'Webhooks',
    items: ['Real-time event notifications', 'HMAC signature verification', 'Auto-retry with backoff', 'Delivery logging', '7 event types'],
  },
  {
    title: 'Payments',
    items: ['1,000 free credits on signup', 'USDC on Base (x402)', 'Autonomous agent payments', 'SDK autoPay mode', 'No gas for agents'],
  },
]

const useCases = [
  {
    title: 'Agent Context',
    desc: 'Give your LLM agents persistent memory that survives between conversations. Store user preferences, past decisions, and task progress.',
  },
  {
    title: 'Research Agents',
    desc: 'Accumulate findings across sessions. Semantic search returns the most relevant information without manual tagging.',
  },
  {
    title: 'Autonomous Bots',
    desc: 'Run bots that manage their own budget. When credits run low, the SDK auto-pays in USDC — no human in the loop.',
  },
  {
    title: 'Multi-Agent Systems',
    desc: 'Share memories between agents. One agent stores facts, another retrieves them. Webhooks keep everything in sync.',
  },
]

export default function Home() {
  return (
    <div className="relative z-10">
      <div className="max-w-5xl mx-auto px-6 py-16 md:py-24">
        {/* Hero */}
        <header className="mb-24">
          <h1
            className="text-6xl md:text-8xl font-bold tracking-tight mb-6 leading-none"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Neura
          </h1>
          <p className="text-lg md:text-xl text-white/40 max-w-2xl mb-10 leading-relaxed">
            An external brain for AI agents. Persistent memory and state
            via HTTP. Semantic search. Autonomous payments.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/signup"
              className="bg-white text-black px-6 py-3 text-sm font-bold hover:bg-white/80 transition-colors border-2 border-white"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Get API Key →
            </Link>
            <Link
              href="/docs"
              className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-white/10 transition-colors border-2 border-white/20"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              API Docs
            </Link>
            <a
              href="https://github.com/ghassan-gaidi/neura"
              className="bg-black text-white/40 px-6 py-3 text-sm font-bold hover:text-white transition-colors border-2 border-white/10"
              style={{ fontFamily: 'var(--font-syne)' }}
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </div>
        </header>

        {/* Stats */}
        <section className="mb-24 grid grid-cols-2 md:grid-cols-4 gap-px bg-white/10">
          {[
            { n: '28', label: 'API Endpoints' },
            { n: '2', label: 'SDKs (TS + Python)' },
            { n: '1,000', label: 'Free Credits' },
            { n: '$1', label: 'Per 1k Credits' },
          ].map((s) => (
            <div key={s.label} className="bg-black p-6 border border-white/5 text-center">
              <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>{s.n}</p>
              <p className="text-xs text-white/30 mt-1">{s.label}</p>
            </div>
          ))}
        </section>

        {/* How it works */}
        <section className="mb-24" id="pricing">
          <h2
            className="text-2xl font-bold mb-10 tracking-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
            {[
              {
                n: '01',
                title: 'Store',
                desc: 'Agents send facts via HTTP. Auto-embedded for semantic search. Batch create up to 25 at once.',
              },
              {
                n: '02',
                title: 'Recall',
                desc: 'Natural language queries return relevant memories with scores. Advanced filters by tags, date range, importance.',
              },
              {
                n: '03',
                title: 'Persist',
                desc: 'Key-value state survives context loss. Webhooks for real-time events with auto-retry. API key dashboard.',
              },
            ].map((item) => (
              <div
                key={item.n}
                className="bg-black p-8 border border-white/5"
              >
                <p className="text-5xl font-bold text-white/10 mb-4" style={{ fontFamily: 'var(--font-syne)' }}>
                  {item.n}
                </p>
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ fontFamily: 'var(--font-syne)' }}
                >
                  {item.title}
                </h3>
                <p className="text-sm text-white/40 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Features Grid */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-10 tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
            Everything you need
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
            {features.map((f) => (
              <div key={f.title} className="bg-black p-8 border border-white/5">
                <h3 className="text-lg font-bold mb-4" style={{ fontFamily: 'var(--font-syne)' }}>{f.title}</h3>
                <ul className="space-y-2">
                  {f.items.map((item) => (
                    <li key={item} className="text-sm text-white/40 flex items-center gap-2">
                      <span className="text-white/20">→</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Code Examples */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-4 tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
            One import, instant memory
          </h2>
          <p className="text-sm text-white/40 mb-6">
            Your agent can use Neura with a single import. No SDK? Use curl.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
            <div className="bg-black p-6 border border-white/5">
              <p className="text-xs text-white/30 mb-2">TypeScript</p>
              <pre className="text-sm leading-relaxed overflow-x-auto"><code>{codeExample}</code></pre>
              <p className="mt-3 text-xs text-white/30"><code className="text-white/60">npm install neura-api</code></p>
            </div>
            <div className="bg-black p-6 border border-white/5">
              <p className="text-xs text-white/30 mb-2">Python</p>
              <pre className="text-sm leading-relaxed overflow-x-auto"><code>{pythonExample}</code></pre>
              <p className="mt-3 text-xs text-white/30"><code className="text-white/60">pip install neura-api-python</code></p>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-10 tracking-tight" style={{ fontFamily: 'var(--font-syne)' }}>
            Built for agents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
            {useCases.map((uc) => (
              <div key={uc.title} className="bg-black p-8 border border-white/5">
                <p className="text-xs text-white/20 mb-1 uppercase tracking-wider">Use Case</p>
                <h3 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-syne)' }}>{uc.title}</h3>
                <p className="text-sm text-white/40 leading-relaxed">{uc.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="mb-24">
          <h2
            className="text-2xl font-bold mb-4 tracking-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Pricing
          </h2>
          <p className="text-sm text-white/40 mb-6">Start free. Scale with on-chain payments.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10">
            <div className="bg-black p-8 border border-white/5">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Free</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>$0</span>
              </div>
              <ul className="space-y-2 text-sm text-white/40 mb-6">
                <li>1,000 credits on signup</li>
                <li>100 memories max</li>
                <li>All API endpoints</li>
                <li>Semantic search</li>
                <li>Webhooks + state</li>
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center bg-white/5 border-2 border-white/20 text-white px-4 py-3 text-sm font-bold hover:bg-white/10 transition-colors"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Sign up free →
              </Link>
            </div>
            <div className="bg-black p-8 border border-white/5">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Pro</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>$1</span>
                <span className="text-white/40 text-sm">USDC / 1000 credits</span>
              </div>
              <ul className="space-y-2 text-sm text-white/40 mb-6">
                <li>Unlimited memories</li>
                <li>Unlimited credits</li>
                <li>All API endpoints</li>
                <li>Batch operations</li>
                <li>Priority support</li>
              </ul>
              <Link
                href="/signup"
                className="block w-full text-center bg-white text-black px-4 py-3 text-sm font-bold hover:bg-white/80 transition-colors border-2 border-white"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                Get started →
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-8 text-xs text-white/20">
          <div className="flex flex-wrap gap-6">
            <span>Neura — Open Source (MIT)</span>
            <span>Built on Base · Supabase · Next.js</span>
            <Link href="/docs" className="hover:text-white/40 transition-colors">Docs</Link>
            <Link href="/signup" className="hover:text-white/40 transition-colors">Sign Up</Link>
            <Link href="/dashboard" className="hover:text-white/40 transition-colors">Dashboard</Link>
            <a href="https://github.com/ghassan-gaidi/neura" className="hover:text-white/40 transition-colors" target="_blank" rel="noopener noreferrer">GitHub</a>
          </div>
        </footer>
      </div>
    </div>
  )
}
