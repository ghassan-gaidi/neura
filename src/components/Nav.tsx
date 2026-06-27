import Link from 'next/link'

export default function Nav() {
  return (
    <nav
      className="relative z-10 border-b border-white/10"
      style={{ fontFamily: 'var(--font-mono)' }}
    >
      <div className="max-w-5xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link
          href="/"
          className="text-sm font-bold tracking-wider uppercase hover:text-white/70 transition-colors"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          Neura
        </Link>
        <div className="flex items-center gap-6 text-xs text-white/50">
          <Link href="/docs" className="hover:text-white transition-colors">
            API Docs
          </Link>
          <Link href="/#pricing" className="hover:text-white transition-colors">
            Pricing
          </Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <a
            href="https://github.com/ghassan-gaidi/neura"
            className="hover:text-white transition-colors"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <Link
            href="/signup"
            className="bg-white text-black px-3 py-1.5 text-xs font-bold hover:bg-white/80 transition-colors"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Sign Up
          </Link>
        </div>
      </div>
    </nav>
  )
}
