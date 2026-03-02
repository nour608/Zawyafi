'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useActiveAccount } from 'thirdweb/react'
import { Store, PieChart, Wallet, BarChart2 } from 'lucide-react'
import { ZawyafiLogo } from '@/components/branding/zawyafi-logo'
import { cn } from '@/lib/utils'
import { formatShortHash } from '@/lib/utils/format'

export function Sidebar() {
  const pathname = usePathname()
  const account = useActiveAccount()
  const address = account?.address
  const isConnected = Boolean(address)

  const links = [
    { name: 'Marketplace', href: '/investor/marketplace', icon: Store, requiresConnection: false },
    { name: 'Portfolio', href: '/investor/portfolio', icon: PieChart, requiresConnection: true },
    { name: 'Wallet', href: '/investor/wallet', icon: Wallet, requiresConnection: true },
    { name: 'Analytics', href: '/investor/analytics', icon: BarChart2, requiresConnection: false },
  ] as const

  const visibleLinks = links.filter((link) => !link.requiresConnection || isConnected)

  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-r border-line bg-panel/80 backdrop-blur lg:flex">
      <div className="p-6 pb-2">
        <Link href="/" className="mb-8 inline-flex flex-col items-start gap-1 transition-opacity hover:opacity-85">
          <ZawyafiLogo className="h-8 w-auto text-text" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-textMuted">Private Markets</p>
        </Link>
        <div className="mb-4 px-2 text-xs font-semibold uppercase tracking-widest text-textMuted">Menu</div>
      </div>

      <nav className="flex flex-1 flex-col gap-1.5 px-4">
        {visibleLinks.map((link) => {
          const isActive = pathname.startsWith(link.href)
          const Icon = link.icon

          return (
            <Link
              key={link.name}
              href={link.href}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all',
                isActive ? 'border border-line bg-panelMuted text-text' : 'text-textMuted hover:bg-panelMuted hover:text-text',
              )}
            >
              <Icon className={cn('size-5 transition-colors', isActive ? 'text-signal' : 'text-textMuted group-hover:text-text')} />
              {link.name}
            </Link>
          )
        })}
      </nav>

      {address ? (
        <div className="border-t border-line p-4">
          <div className="flex items-center gap-3 rounded-lg border border-transparent px-2 py-2">
            <div className="flex size-10 items-center justify-center rounded-full border border-line bg-panel font-bold text-gold">
              {address.slice(2, 4).toUpperCase()}
            </div>
            <div className="flex flex-col overflow-hidden">
              <p className="truncate text-sm font-bold text-text">{formatShortHash(address)}</p>
              <p className="truncate text-xs text-textMuted">Connected Investor</p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
