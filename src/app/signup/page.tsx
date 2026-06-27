'use client'

import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabaseBrowser.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="text-white px-6 pt-16 md:pt-24">
        <div className="max-w-md mx-auto text-center">
          <h1
            className="text-4xl font-bold mb-6 tracking-tight"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            Check your email
          </h1>
          <p className="text-white/70 text-lg mb-8">
            We sent a magic link to <span className="text-white font-bold">{email}</span>.
            Click the link to sign in and get your API key.
          </p>
          <button
            onClick={() => { setSent(false); setEmail('') }}
            className="text-white/50 hover:text-white text-sm underline underline-offset-4 transition-colors"
          >
            Try a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-white px-6 pt-16 md:pt-24">
      <div className="max-w-md mx-auto">
        <h1
          className="text-4xl font-bold mb-3 tracking-tight"
          style={{ fontFamily: 'var(--font-syne)' }}
        >
          Get your API key
        </h1>
        <p className="text-white/60 text-lg mb-10">
          Sign up with your email. No password needed — we&apos;ll send you a magic link.
          <br />
          <span className="text-white font-semibold">1,000 free credits included.</span>
        </p>

        <form onSubmit={handleSignup} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="agent@example.com"
            required
            className="w-full bg-white/10 border border-white/30 px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-white focus:bg-white/15 transition-colors text-lg"
            style={{ fontFamily: 'var(--font-dm-mono)' }}
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black px-6 py-3 text-sm font-bold hover:bg-white/80 transition-colors border-2 border-white disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-syne)' }}
          >
            {loading ? 'Sending magic link...' : 'Send magic link →'}
          </button>
        </form>

        {error && (
          <p className="mt-4 text-red-400 text-sm">{error}</p>
        )}

        <p className="mt-8 text-white/30 text-xs">
          By signing up you agree to our Terms. Your API key grants access to the Neura API.
        </p>
      </div>
    </div>
  )
}
