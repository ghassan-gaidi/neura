'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Verifying magic link...')

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabaseBrowser.auth.getSession()

      if (error || !data.session) {
        setStatus('Invalid or expired link. Please try again.')
        setTimeout(() => router.push('/signup'), 3000)
        return
      }

      // User is authenticated — fetch their API key
      setStatus('Authenticated! Fetching your API key...')

      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      })

      if (!res.ok) {
        setStatus('Failed to load your API key. Try the dashboard.')
        setTimeout(() => router.push('/dashboard'), 3000)
        return
      }

      const result = await res.json()
      const apiKey = result.data?.raw_key || result.data?.api_key

      if (apiKey) {
        // Store in localStorage and redirect to dashboard with key
        localStorage.setItem('neura_api_key', apiKey)
        router.push('/dashboard?key=' + encodeURIComponent(apiKey))
      } else {
        // Key not found — redirect to dashboard for manual entry
        router.push('/dashboard')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="text-white flex items-center justify-center min-h-screen">
      <p className="text-white/60 text-lg">{status}</p>
    </div>
  )
}
