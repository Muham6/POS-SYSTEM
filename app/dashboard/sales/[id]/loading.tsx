export default function Loading() {
  return (
    <div className="max-w-lg">
      <div className="h-4 w-24 animate-pulse rounded bg-neutral-200" />
      <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-6">
        <div className="h-6 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="mt-2 h-4 w-32 animate-pulse rounded bg-neutral-100" />
        <div className="mt-6 space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      </div>
    </div>
  )
}