import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type Profile = {
  id: string
  full_name: string
  role: 'admin' | 'cashier'
  is_active: boolean
}

// The currently signed-in auth user (or null).
export async function getSessionUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return user
}

// The signed-in user's app profile (name + role) from our profiles table.
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, role, is_active')
    .eq('id', user.id)
    .single()

  if (!data) return null

  // A deactivated account should not stay signed in, even with a valid session.
  if (!data.is_active) {
    await supabase.auth.signOut()
    return null
  }

  return data as Profile
}

// Drop this at the top of ANY admin-only page or layout in later phases:
//   const profile = await requireAdmin()
// A cashier who tries to reach it gets sent back to the dashboard.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getProfile()

  if (!profile) redirect('/login')

  if (profile.role !== 'admin') {
    redirect('/dashboard')
  }

  return profile
}