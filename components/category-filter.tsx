'use client'

import { useRouter } from 'next/navigation'

export default function CategoryFilter({
  categories,
  current,
}: {
  categories: { id: string; name: string }[]
  current?: string
}) {
  const router = useRouter()

  return (
    <select
      value={current || ''}
      onChange={(e) => {
        const value = e.target.value
        router.push(value ? `/dashboard/products?category=${value}` : '/dashboard/products')
      }}
      className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-emerald-400"
    >
      <option value="">All categories</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  )
}