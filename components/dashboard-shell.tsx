'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/sign-out-button'

type NavLink = { href: string; label: string; live: boolean }

export default function DashboardShell({
  children,
  links,
  fullName,
  role,
}: {
  children: React.ReactNode
  links: NavLink[]
  fullName: string
  role: string
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Mobile overlay */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar — slides in on mobile, always visible on lg+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col justify-between border-r border-neutral-200 bg-white p-5 transition-transform lg:static lg:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2 font-mono text-sm tracking-widest text-neutral-800">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              MUHAM&nbsp;POS
            </div>
            <button
              onClick={() => setMenuOpen(false)}
              className="text-neutral-400 lg:hidden"
              aria-label="Close menu"
            >
              ✕
            </button>
          </div>

          <nav className="space-y-1">
            {links.map((link) => {
              const active = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-neutral-700 hover:bg-neutral-100'
                  }`}
                >
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

      {/* Main area */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-4 sm:px-8">
          <button
            onClick={() => setMenuOpen(true)}
            className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            aria-label="Open menu"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <p className="text-sm text-neutral-500">
            Signed in as <span className="font-medium text-neutral-800">{role}</span>
          </p>
          <SignOutButton />
        </header>
        <main className="flex-1 p-4 sm:p-8">{children}</main>
      </div>
    </div>
  )
}