export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-7 w-24 animate-pulse rounded bg-neutral-200" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-neutral-100 p-4 last:border-0">
                <div className="h-4 w-28 animate-pulse rounded bg-neutral-200" />
                <div className="h-4 w-36 animate-pulse rounded bg-neutral-200" />
                <div className="ml-auto h-4 w-16 animate-pulse rounded bg-neutral-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    </div>
  )
}