export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-4 w-28 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mx-auto max-w-md rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto mb-4 h-5 w-40 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
          ))}
        </div>
      </div>
    </div>
  )
}
