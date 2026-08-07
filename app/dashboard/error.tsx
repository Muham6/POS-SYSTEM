'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-2xl text-red-600">
        !
      </div>
      <h1 className="text-lg font-semibold text-neutral-900">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        That didn&apos;t load correctly. This is usually temporary — try again, or head back to the overview.
      </p>
      <div className="mt-5 flex gap-3">
        <button
          onClick={reset}
          className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          Back to Overview
        </Link>
      </div>
    </div>
  )
}