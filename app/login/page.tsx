'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
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
  const [logoUrl, setLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('store_settings')
      .select('store_name, logo_url')
      .eq('id', 1)
      .single()
      .then(({ data }) => {
        if (data?.store_name) setStoreName(data.store_name)
        if (data?.logo_url) setLogoUrl(data.logo_url)
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
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6 py-12 dark:bg-neutral-950">
      <div className="w-full max-w-sm">
        <div className="text-center">
          {logoUrl && (
            <div className="mx-auto mb-4 h-12 w-12 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
              <Image src={logoUrl} alt={storeName} width={48} height={48} className="h-full w-full object-cover" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">{storeName}</h1>
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
            Point of sale
          </p>
        </div>

        <div className="mt-8 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm shadow-neutral-200/60 dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none sm:p-7">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Sign in</h2>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">Use the account set up for you.</p>

          <form onSubmit={handleSignIn} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                placeholder="you@shop.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
              >
                Password
              </label>
              <div className="relative mt-2">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-16 text-sm text-neutral-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-emerald-600 dark:text-neutral-500 dark:hover:text-emerald-400"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 font-medium text-white transition hover:bg-emerald-600 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400 dark:text-neutral-600">
          Built by <span className="font-medium text-neutral-500 dark:text-neutral-500">Muham</span>
        </p>
      </div>
    </div>
  )
}
