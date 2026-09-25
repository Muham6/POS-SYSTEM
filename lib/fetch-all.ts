// Supabase caps any single select at 1000 rows and says nothing about it. A
// page that sums money from a capped read shows a confidently wrong number, so
// anything totalling has to page through deliberately.
//
// buildPage receives the row window and returns the query for it.
export async function fetchAllRows<T>(
  buildPage: (fromRow: number, toRow: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  { pageSize = 1000, maxPages = 50 }: { pageSize?: number; maxPages?: number } = {}
): Promise<{ rows: T[]; truncated: boolean; error: string | null }> {
  const rows: T[] = []

  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await buildPage(page * pageSize, page * pageSize + pageSize - 1)

    if (error) return { rows, truncated: false, error: error.message }

    const batch = data || []
    rows.push(...batch)

    // A short page means we've reached the end.
    if (batch.length < pageSize) return { rows, truncated: false, error: null }
  }

  // Hit the ceiling: report it rather than quietly returning a partial total.
  return { rows, truncated: true, error: null }
}
