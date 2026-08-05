export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-7 w-32 animate-pulse rounded bg-neutral-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl bg-neutral-100" />
        ))}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
        <div className="h-40 animate-pulse rounded-xl bg-neutral-100" />
      </div>
    </div>
  )
}