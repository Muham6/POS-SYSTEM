'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Receipt } from 'lucide-react'

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
    <div className="flex min-h-screen bg-white">
      {/* Brand panel */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-500 to-emerald-400 p-12 lg:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -right-16 h-96 w-96 rounded-full bg-emerald-900/20 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-white/15 backdrop-blur-sm">
            {logoUrl ? (
              <Image src={logoUrl} alt={storeName} width={36} height={36} className="h-full w-full object-cover" />
            ) : (
              <Receipt size={18} className="text-white" />
            )}
          </span>
          <span className="text-sm font-semibold tracking-wide text-white">{storeName}</span>
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-50/80">Point of sale</p>
          <h1 className="mt-4 text-4xl font-bold leading-[1.15] text-white sm:text-5xl">
            Sell, track stock, and close the day with clean numbers.
          </h1>
          <p className="mt-5 text-sm text-emerald-50/80">
            One screen for every sale, every shift, and everything on the shelf.
          </p>
        </div>

        <p className="relative text-xs text-emerald-50/60">built by Muham</p>
      </div>

      {/* Form panel */}
      <div className="flex w-full items-center justify-center bg-neutral-50 px-6 lg:w-1/2 lg:bg-white">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-emerald-50">
              {logoUrl ? (
                <Image src={logoUrl} alt={storeName} width={36} height={36} className="h-full w-full object-cover" />
              ) : (
                <Receipt size={18} className="text-emerald-600" />
              )}
            </span>
            <span className="text-sm font-semibold tracking-wide text-neutral-800">{storeName}</span>
          </div>

          <h2 className="text-2xl font-semibold text-neutral-900">Sign in</h2>
          <p className="mt-1 text-sm text-neutral-500">Use the account set up for you.</p>

          <form onSubmit={handleSignIn} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-2 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-emerald-500"
                placeholder="you@shop.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-neutral-500"
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
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2.5 pr-16 text-sm text-neutral-900 outline-none transition focus:border-emerald-500"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-pressed={showPassword}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium uppercase tracking-wider text-neutral-400 hover:text-emerald-600"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
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
      </div>
    </div>
  )
}
