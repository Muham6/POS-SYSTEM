'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'

export default function ProductSearch({
  current,
  category,
}: {
  current?: string
  category?: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(current || '')
  const firstRun = useRef(true)

  // Filters as the user types, but waits for a pause so each keystroke
  // doesn't trigger its own round trip to the server.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    const timer = setTimeout(() => {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      if (value.trim()) params.set('q', value.trim())
      const qs = params.toString()
      router.replace(qs ? `/dashboard/products?${qs}` : '/dashboard/products')
    }, 300)
    return () => clearTimeout(timer)
  }, [value, category, router])

  return (
    <div className="relative min-w-0 flex-1 sm:max-w-md">
      <Search
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search name or SKU"
        aria-label="Search products"
        className="w-full rounded-lg border border-neutral-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
      />
    </div>
  )
}
