'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/sign-out-button'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt as ReceiptIcon,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  Menu,
  X,
} from 'lucide-react'

type NavLink = { href: string; label: string; live: boolean }

const iconMap: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/sell': ShoppingCart,
  '/dashboard/products': Package,
  '/dashboard/sales': ReceiptIcon,
  '/dashboard/reports': BarChart3,
  '/dashboard/users': Users,
  '/dashboard/settings': SettingsIcon,
}

// The 4 most-used screens get a permanent mobile bottom tab.
const mobileTabHrefs = ['/dashboard', '/dashboard/sell', '/dashboard/products', '/dashboard/reports']

export default function DashboardShell({
  children,
  links,
  fullName,
  role,
  storeName,
  logoUrl,
}: {
  children: React.ReactNode
  links: NavLink[]
  fullName: string
  role: string
  storeName: string
  logoUrl?: string | null
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  const mobileTabs = links.filter((l) => mobileTabHrefs.includes(l.href))

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenuOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col justify-between border-r border-neutral-200 bg-white p-5 transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {logoUrl ? (
                <Image src={logoUrl} alt={storeName} width={28} height={28} className="rounded-md object-cover" />
              ) : (
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              )}
              <span className="truncate text-sm font-semibold text-neutral-800">{storeName}</span>
            </div>
            <button onClick={() => setMenuOpen(false)} className="text-neutral-400 lg:hidden" aria-label="Close menu">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1">
            {links.map((link) => {
              const active = pathname === link.href
              const Icon = iconMap[link.href] || LayoutDashboard
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
                  <Icon size={18} />
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        <div className="border-t border-neutral-200 pt-4">
          <p className="text-sm font-medium text-neutral-800">{fullName || 'Unnamed user'}</p>
          <span className="mt-1 inline-block rounded-full bg-neutral-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
            {role}
          </span>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-16 lg:pb-0">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 sm:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>
          <p className="text-sm text-neutral-500">
            Signed in as <span className="font-medium text-neutral-800">{role}</span>
          </p>
          <SignOutButton />
        </header>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white lg:hidden">
        {mobileTabs.map((link) => {
          const active = pathname === link.href
          const Icon = iconMap[link.href] || LayoutDashboard
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? 'text-emerald-600' : 'text-neutral-400'
              }`}
            >
              <Icon size={20} />
              {link.label === 'Overview' ? 'Home' : link.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}