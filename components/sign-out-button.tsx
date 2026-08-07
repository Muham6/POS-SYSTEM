'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await supabase.auth.signOut()
    } catch {
      // Even if the network call fails, we still want to send them to login.
    } finally {
      router.push('/login')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-60"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
