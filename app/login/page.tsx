'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [storeName, setStoreName] = useState('POS System')

  useEffect(() => {
    supabase
      .from('store_settings')
      .select('store_name')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data?.store_name) setStoreName(data.store_name)
      })
  }, [supabase])

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Those details did not match. Check your email and password.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-neutral-800 p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="relative flex items-center gap-2 font-mono text-sm tracking-widest text-neutral-400">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
          {storeName}
        </div>

        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
            point of sale
          </p>
          <h1 className="mt-4 max-w-sm text-4xl font-semibold leading-tight">
            Sell, track stock, and close the day with clean numbers.
          </h1>
          <p className="mt-6 font-mono text-sm text-neutral-500">
            <span className="text-emerald-400">$</span> awaiting sign-in
            <span className="ml-1 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-emerald-400" />
          </p>
        </div>

        <p className="relative font-mono text-xs text-neutral-600">
          built by Muham 
        </p>
      </div>

      <div className="flex w-full items-center justify-center px-6 lg:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2 font-mono text-sm tracking-widest text-neutral-400">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />
              {storeName}
            </div>
          </div>

          <h2 className="text-2xl font-semibold">Sign in</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Use the account set up for you.
          </p>

          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block font-mono text-xs uppercase tracking-wider text-neutral-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 text-neutral-100 outline-none transition focus:border-emerald-400"
                placeholder="you@shop.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block font-mono text-xs uppercase tracking-wider text-neutral-400"
              >
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5 pr-16 text-neutral-100 outline-none transition focus:border-emerald-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs uppercase tracking-wider text-neutral-500 hover:text-emerald-400"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-400 px-4 py-2.5 font-medium text-neutral-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}