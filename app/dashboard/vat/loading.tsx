export default function Loading() {
  return (
    <div>
      <div className="mb-2 h-4 w-24 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="mb-6 h-8 w-56 animate-pulse rounded bg-neutral-200 dark:bg-neutral-800" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 animate-pulse rounded-xl bg-neutral-100 dark:bg-neutral-800" />
        ))}
      </div>
    </div>
  )
}
