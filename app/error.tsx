'use client'

import { useEffect } from 'react'

export default function GlobalError({
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 text-center text-neutral-100">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-2xl text-red-400">
        !
      </div>
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="mt-1 max-w-sm text-sm text-neutral-400">Please try again.</p>
      <button
        onClick={reset}
        className="mt-5 rounded-lg bg-emerald-400 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-emerald-300"
      >
        Try again
      </button>
    </div>
  )
}