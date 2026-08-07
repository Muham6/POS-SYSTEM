import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 text-center">
      <p className="font-mono text-sm uppercase tracking-widest text-neutral-400">404</p>
      <h1 className="mt-2 text-2xl font-semibold text-neutral-900">Page not found</h1>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">
        That page doesn&apos;t exist, or the link is out of date.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
      >
        Back to Overview
      </Link>
    </div>
  )
}