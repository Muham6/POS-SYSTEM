'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/sign-out-button'
import OnlineStatusBanner from '@/components/online-status-banner'
import HelpAssistant from '@/components/help-assistant'
import NavTour from '@/components/nav-tour'
import ToastProvider from '@/components/toast-provider'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  Receipt as ReceiptIcon,
  BarChart3,
  Users,
  Settings as SettingsIcon,
  Truck,
  Clock,
  Percent,
  Menu,
  X,
  HelpCircle,
} from 'lucide-react'

type NavLink = {
  href: string
  label: string
  live: boolean
}

const iconMap: Record<string, React.ElementType> = {
  '/dashboard': LayoutDashboard,
  '/dashboard/sell': ShoppingCart,
  '/dashboard/products': Package,
  '/dashboard/stock-history': Boxes,
  '/dashboard/suppliers': Truck,
  '/dashboard/shift': Clock,
  '/dashboard/shift/history': Clock,
  '/dashboard/sales': ReceiptIcon,
  '/dashboard/reports': BarChart3,
  '/dashboard/vat': Percent,
  '/dashboard/users': Users,
  '/dashboard/settings': SettingsIcon,
}

// The 4 most-used screens get a permanent mobile bottom tab.
const mobileTabHrefs = [
  '/dashboard',
  '/dashboard/sell',
  '/dashboard/products',
  '/dashboard/reports',
]

export default function DashboardShell({
  children,
  links,
  fullName,
  role,
  storeName,
  logoUrl,
  userId,
}: {
  children: React.ReactNode
  links: NavLink[]
  fullName: string
  role: string
  storeName: string
  logoUrl?: string | null
  userId: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [tourActive, setTourActive] = useState(false)
  const [tourKey, setTourKey] = useState(0)
  const pathname = usePathname()

  function startTour() {
    setTourKey((k) => k + 1)
    setTourActive(true)
  }

  const tourStorageKey = `pos_tour_done_v1_${userId}`

  useEffect(() => {
    if (!localStorage.getItem(tourStorageKey)) {
      const t = setTimeout(startTour, 600)
      return () => clearTimeout(t)
    }
  }, [tourStorageKey])

  // Force the sidebar visible on mobile while the tour runs, regardless of manual toggling.
  const sidebarOpen = menuOpen || tourActive

  const mobileTabs = links.filter((l) =>
    mobileTabHrefs.includes(l.href)
  )

  return (
    <ToastProvider>
    <div className="flex min-h-screen flex-col">
      <div className="print:hidden">
        <OnlineStatusBanner />
        <NavTour
          key={tourKey}
          steps={links.map((l) => ({ href: l.href, label: l.label }))}
          storageKey={tourStorageKey}
          active={tourActive}
          onFinish={() => setTourActive(false)}
        />
        <HelpAssistant />
      </div>

      <div className="flex flex-1 bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden print:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}

        <aside
          className={`print:hidden fixed inset-y-0 left-0 z-50 flex w-60 flex-col justify-between border-r border-neutral-200 bg-white p-5 transition-transform dark:border-neutral-800 dark:bg-neutral-900 lg:static lg:translate-x-0 ${
            sidebarOpen
              ? 'translate-x-0'
              : '-translate-x-full'
          }`}
        >
          <div>
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {logoUrl ? (
                  <Image
                    src={logoUrl}
                    alt={storeName}
                    width={28}
                    height={28}
                    className="rounded-md object-cover"
                  />
                ) : (
                  <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                )}

                <span className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  {storeName}
                </span>
              </div>

              <button
                onClick={() => setMenuOpen(false)}
                className="text-neutral-400 dark:text-neutral-500 lg:hidden"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="space-y-1">
              {links.map((link) => {
                const active = pathname === link.href
                const Icon =
                  iconMap[link.href] || LayoutDashboard

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-tour-nav={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <Icon size={18} />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          </div>

          <div className="border-t border-neutral-200 pt-4 dark:border-neutral-800">
            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {fullName || 'Unnamed user'}
            </p>

            <span className="mt-1 inline-block rounded-full bg-neutral-900 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white dark:bg-neutral-100 dark:text-neutral-900">
              {role}
            </span>
          </div>
        </aside>

        <div className="flex flex-1 flex-col pb-16 lg:pb-0">
          <header className="print:hidden flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900 sm:px-8">
            <button
              onClick={() => setMenuOpen(true)}
              className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 lg:hidden"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>

            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Signed in as{' '}
              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                {role}
              </span>
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={startTour}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                aria-label="Take the tour again"
                title="Take the tour again"
              >
                <HelpCircle size={18} />
              </button>
              <SignOutButton />
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-8 print:p-0">
            {children}
          </main>
        </div>

        {/* Mobile bottom tab bar */}
        <nav className="print:hidden fixed inset-x-0 bottom-0 z-30 flex border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:hidden">
          {mobileTabs.map((link) => {
            const active = pathname === link.href
            const Icon =
              iconMap[link.href] || LayoutDashboard

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  active
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-neutral-400 dark:text-neutral-500'
                }`}
              >
                <Icon size={20} />
                {link.label === 'Overview'
                  ? 'Home'
                  : link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
    </ToastProvider>
  )
}