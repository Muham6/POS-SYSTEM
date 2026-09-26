// Turns a database error into something a shopkeeper can act on.
//
// Postgres and PostgREST messages are written for whoever wrote the query, not
// whoever is standing at the till. "Could not find the table
// 'public.stock_counts' in the schema cache" tells a shop owner nothing about
// what to do, and reads like the system is broken when a migration simply
// hasn't been run yet.
export function friendlyError(message: string | null | undefined): string {
  if (!message) return 'Something went wrong loading this page.'

  const m = message.toLowerCase()

  // PGRST205 — the table exists in the code but not in this database.
  if (m.includes('schema cache') || m.includes('could not find the table')) {
    return 'This feature needs a database update that has not been run yet. Ask whoever set the system up to run the latest migration in Supabase.'
  }

  // PGRST202 — same, for a function.
  if (m.includes('could not find the function')) {
    return 'This feature needs a database update that has not been run yet. Ask whoever set the system up to run the latest migration in Supabase.'
  }

  if (m.includes('more than one relationship')) {
    return 'This page could not read its data because of an ambiguous link between tables. Please report this.'
  }

  if (m.includes('jwt') || m.includes('not authenticated') || m.includes('not signed in')) {
    return 'Your session has expired. Please sign in again.'
  }

  if (m.includes('permission denied') || m.includes('row-level security') || m.includes('only admins')) {
    return "You don't have permission to do that."
  }

  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return "Couldn't reach the server. Check your internet connection and try again."
  }

  // Anything unrecognised: show it, since a vague message is worse than a
  // technical one when someone is trying to report a fault.
  return message
}
