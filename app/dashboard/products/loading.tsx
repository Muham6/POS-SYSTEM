export default function Loading() {
  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="h-7 w-32 animate-pulse rounded bg-neutral-200" />
        <div className="h-9 w-32 animate-pulse rounded-lg bg-neutral-200" />
      </div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-neutral-100 p-4 last:border-0">
            <div className="h-4 w-32 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-16 animate-pulse rounded bg-neutral-200" />
            <div className="h-4 w-20 animate-pulse rounded bg-neutral-200" />
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-neutral-200" />
          </div>
        ))}
      </div>
    </div>
  )
}