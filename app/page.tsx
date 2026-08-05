import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth'

// The home route just forwards you: to the dashboard if signed in,
// otherwise to the login page.
export default async function Home() {
  const user = await getSessionUser()
  redirect(user ? '/dashboard' : '/login')
}
