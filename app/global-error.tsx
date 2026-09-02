'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-neutral-50 px-4 text-center">
          <h1 className="text-xl font-semibold text-neutral-900">Something went wrong</h1>
          <p className="text-sm text-neutral-500">Please try again — if this keeps happening, let an admin know.</p>
          <button
            onClick={reset}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
