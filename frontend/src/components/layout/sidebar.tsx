'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart2, LogOut, PieChart, Settings, ShieldCheck, Store, Wallet } from 'lucide-react'
import { useActiveWallet, useDisconnect } from 'thirdweb/react'
import { ZawyafiLogo } from '@/components/branding/zawyafi-logo'
import { useCapabilities } from '@/hooks/use-capabilities'
import { clearWalletAuthSession } from '@/lib/api/wallet-auth'
import { cn } from '@/lib/utils'
import { formatShortHash } from '@/lib/utils/format'
import type { RoleCapability } from '@/lib/types/frontend'

type SidebarPortal = 'investor' | 'merchant' | 'compliance' | 'admin'

const resolvePortal = (pathname: string, capabilities: RoleCapability): SidebarPortal => {
  if (pathname.startsWith('/compliance/kyc')) {
    return 'investor'
  }

  if (capabilities.canUseAdmin && (pathname.startsWith('/admin') || pathname.startsWith('/compliance') || pathname.startsWith('/merchant'))) {
    return 'admin'
  }

  if (pathname.startsWith('/admin')) return 'admin'
  if (pathname.startsWith('/merchant')) return 'merchant'
  if (pathname.startsWith('/compliance') && !pathname.startsWith('/compliance/kyc')) return 'compliance'

  return 'investor'
}

export function Sidebar() {
  const pathname = usePathname() || '/'
  const { address, capabilities, isConnected } = useCapabilities()
  const portal = resolvePortal(pathname, capabilities)
  const wallet = useActiveWallet()
  const { disconnect } = useDisconnect()

  const handleDisconnect = () => {
    if (!wallet) return
    clearWalletAuthSession()
    disconnect(wallet)
  }

  const linksByPortal = {
    investor: [
      { name: 'Marketplace', href: '/investor/marketplace', icon: Store, requiresConnection: false },
      { name: 'Portfolio', href: '/investor/portfolio', icon: PieChart, requiresConnection: true },
      { name: 'Wallet', href: '/investor/wallet', icon: Wallet, requiresConnection: true },
      { name: 'Analytics', href: '/investor/analytics', icon: BarChart2, requiresConnection: false },
    ],
    merchant: [
      { name: 'Operations', href: '/merchant', icon: Store, requiresConnection: false },
      { name: 'Marketplace', href: '/investor/marketplace', icon: PieChart, requiresConnection: false },
      { name: 'Wallet', href: '/investor/wallet', icon: Wallet, requiresConnection: true },
    ],
    compliance: [
      { name: 'Compliance Ops', href: '/compliance', icon: ShieldCheck, requiresConnection: false },
      { name: 'Wallet', href: '/investor/wallet', icon: Wallet, requiresConnection: true },
    ],
    admin: [
      { name: 'Admin Controls', href: '/admin', icon: Settings, requiresConnection: false },
      { name: 'Compliance Ops', href: '/compliance', icon: ShieldCheck, requiresConnection: false },
      { name: 'Merchant Ops', href: '/merchant', icon: Store, requiresConnection: false },
    ],
  } as const

  const roleLabelByPortal: Record<SidebarPortal, string> = {
    investor: 'Connected Investor',
    merchant: 'Connected Merchant',
    compliance: 'Connected Compliance',
    admin: 'Connected Admin',
  }

  const visibleLinks = linksByPortal[portal].filter((link) => !link.requiresConnection || isConnected)

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
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-panel font-bold text-gold">
              {address.slice(2, 4).toUpperCase()}
            </div>
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <p className="truncate text-sm font-bold text-text">{formatShortHash(address)}</p>
              <p className="truncate text-xs text-textMuted">{roleLabelByPortal[portal]}</p>
            </div>
            <button
              onClick={handleDisconnect}
              aria-label="Disconnect wallet"
              title="Disconnect"
              className="shrink-0 rounded-lg p-2 text-textMuted transition-colors hover:bg-panelMuted hover:text-text"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
