import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/auth'
import DashboardShell from '@/components/dashboard-shell'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()
  if (!profile) redirect('/login')

  const supabase = await createClient()
  const { data: settings } = await supabase.from('store_settings').select('store_name').eq('id', 1).single()

  const isAdmin = profile.role === 'admin'

  const baseLinks = [
    { href: '/dashboard', label: 'Overview', live: true },
    { href: '/dashboard/sell', label: 'Sell', live: true },
  ]
  const adminLinks = [
    { href: '/dashboard/products', label: 'Products', live: true },
    { href: '/dashboard/sales', label: 'Sales History', live: true },
    { href: '/dashboard/settings', label: 'Settings', live: true },
    { href: '/dashboard/reports', label: 'Reports', live: true },
    { href: '/dashboard/users', label: 'Users', live: true },
  ]

  const links = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks

  return (
    <DashboardShell 
      links={links} 
      fullName={profile.full_name} 
      role={profile.role}
      storeName={settings?.store_name || 'POS System'}
    >
      {children}
    </DashboardShell>
  )
}