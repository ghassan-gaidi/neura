import Link from 'next/link'

const codeExample = `import { Neura } from 'neura-api'

const neura = new Neura({ apiKey: 'sk-...' })

// Remember
await neura.memory.create({ content: 'User prefers dark mode' })

// Recall
const results = await neura.memory.search('UI preferences')`

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
          <div className="flex gap-3">
            <Link
              href="/docs"
              className="bg-white text-black px-6 py-3 text-sm font-bold hover:bg-white/80 transition-colors border-2 border-white"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              API Docs →
            </Link>
            <Link
              href="/dashboard"
              className="bg-black text-white px-6 py-3 text-sm font-bold hover:bg-white/10 transition-colors border-2 border-white/20"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Dashboard
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

        {/* How it works */}
        <section className="mb-24">
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
                desc: 'Agents send facts via HTTP. Auto-embedded for semantic search.',
              },
              {
                n: '02',
                title: 'Recall',
                desc: 'Natural language queries return relevant memories with scores.',
              },
              {
                n: '03',
                title: 'Persist',
                desc: 'Key-value state survives context loss. Webhooks for events.',
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

        {/* Code Example */}
        <section className="mb-24">
          <h2
            className="text-2xl font-bold mb-4 tracking-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            A single line
          </h2>
          <p className="text-sm text-white/40 mb-6">
            Your agent can use Neura with one import. No SDK install? Use curl.
          </p>
          <div className="bg-white/5 border-2 border-white/10 p-6">
            <pre className="text-sm leading-relaxed overflow-x-auto">
              <code>{codeExample}</code>
            </pre>
          </div>
          <div className="mt-3 flex gap-4 text-xs text-white/30">
            <span>TypeScript SDK: <code className="text-white/60">npm install neura-api</code></span>
            <span>Python SDK: <code className="text-white/60">pip install neura-api</code></span>
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
          <div className="border-2 border-white/10 bg-white/[0.02] p-8">
            <div className="flex items-baseline gap-3 mb-4">
              <span
                className="text-5xl font-bold"
                style={{ fontFamily: 'var(--font-syne)' }}
              >
                $1
              </span>
              <span className="text-white/40 text-sm">USDC / 1000 credits</span>
            </div>
            <ul className="space-y-2 text-sm text-white/40">
              <li>Store a memory: <span className="text-white/60">1 credit</span></li>
              <li>Semantic search: <span className="text-white/60">1 credit</span></li>
              <li>Advanced search: <span className="text-white/60">2 credits</span></li>
              <li>List / Delete / State ops: <span className="text-white/60">free</span></li>
              <li className="pt-2 border-t border-white/10 mt-2">
                New agents get <span className="text-white font-bold">1000 free credits</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/10 pt-8 text-xs text-white/20">
          <div className="flex flex-wrap gap-6">
            <span>Neura — Open Source (MIT)</span>
            <span>Built on Base · Supabase · Next.js</span>
          </div>
        </footer>
      </div>
    </div>
  )
}
