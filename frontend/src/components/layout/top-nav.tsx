'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'
import { ZawyafiLogo } from '@/components/branding/zawyafi-logo'

const WalletActionButton = dynamic(
  () => import('@/components/shared/wallet-action-button').then((module) => module.WalletActionButton),
  { ssr: false },
)

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleToggleMenu = (): void => {
    setMobileOpen((current) => !current)
  }

  const handleCloseMenu = (): void => {
    setMobileOpen(false)
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6">
      <div className="mx-auto max-w-[1280px] rounded-2xl border border-cc-border bg-[var(--bg-surface)]/90 shadow-[0_10px_32px_rgba(10,12,16,0.12)] backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-5 lg:px-7">
          <Link href="/" className="flex items-center">
            <ZawyafiLogo className="h-7 w-auto text-cc-text lg:h-8" />
          </Link>

          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/#how-it-works" className="text-sm font-medium text-cc-text-sec transition-colors hover:text-cc-text">
              How It Works
            </Link>
            <Link href="/investor/marketplace" className="text-sm font-medium text-cc-text-sec transition-colors hover:text-cc-text">
              Marketplace
            </Link>
            <Link href="/#about" className="text-sm font-medium text-cc-text-sec transition-colors hover:text-cc-text">
              About
            </Link>
          </nav>

          <div className="hidden items-center gap-4 md:flex">
            <WalletActionButton labelDisconnected="Log in" variant="ghost" showAddressWhenConnected={false} />
            <Link
              href="/investor/marketplace"
              className="inline-flex items-center justify-center bg-[#161733] px-9 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-[#f5f2eb] transition-all duration-300 [clip-path:polygon(9px_0%,100%_0%,calc(100%-9px)_100%,0_100%)] hover:brightness-110 dark:bg-[linear-gradient(135deg,#c9a84c,#e8c97a)] dark:text-[#0a0c10]"
            >
              START INVESTING
            </Link>
          </div>

          <button
            className="flex size-10 items-center justify-center rounded-lg text-cc-text transition-colors hover:bg-cc-bg-alt md:hidden"
            onClick={handleToggleMenu}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="mx-auto mt-2 max-w-[1280px] rounded-2xl border border-cc-border bg-[var(--bg-surface)]/95 p-4 shadow-[0_12px_30px_rgba(10,12,16,0.12)] backdrop-blur-xl md:hidden">
          <nav className="flex flex-col gap-2">
            <Link
              href="/"
              className="flex items-center justify-between rounded-xl border border-cc-border/70 px-4 py-3 text-base font-medium text-cc-text transition-colors hover:bg-cc-bg-alt"
              onClick={handleCloseMenu}
            >
              Home
              <ArrowRight className="size-5 rotate-180 text-cc-text-sec" />
            </Link>
            <Link
              href="/investor/marketplace"
              className="flex items-center justify-between rounded-xl border border-cc-border/70 px-4 py-3 text-base font-medium text-cc-text transition-colors hover:bg-cc-bg-alt"
              onClick={handleCloseMenu}
            >
              Marketplace
              <ArrowRight className="size-5 text-cc-text-sec" />
            </Link>
            <Link
              href="/#how-it-works"
              className="flex items-center justify-between rounded-xl border border-cc-border/70 px-4 py-3 text-base font-medium text-cc-text transition-colors hover:bg-cc-bg-alt"
              onClick={handleCloseMenu}
            >
              How It Works
              <ArrowRight className="size-5 text-cc-text-sec" />
            </Link>
            <Link
              href="/#about"
              className="flex items-center justify-between rounded-xl border border-cc-border/70 px-4 py-3 text-base font-medium text-cc-text transition-colors hover:bg-cc-bg-alt"
              onClick={handleCloseMenu}
            >
              About
              <ArrowRight className="size-5 text-cc-text-sec" />
            </Link>

            <div className="mt-3">
              <WalletActionButton labelDisconnected="Log in" variant="cc-outline" showAddressWhenConnected={false} className="w-full" />
            </div>

            <div>
              <Link
                href="/investor/marketplace"
                className="flex w-full items-center justify-center bg-[#161733] px-9 py-3.5 font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-[#f5f2eb] transition-all duration-300 [clip-path:polygon(9px_0%,100%_0%,calc(100%-9px)_100%,0_100%)] hover:brightness-110 dark:bg-[linear-gradient(135deg,#c9a84c,#e8c97a)] dark:text-[#0a0c10]"
                onClick={handleCloseMenu}
              >
                START INVESTING
              </Link>
            </div>

            <div className="pt-3 text-center text-xs text-cc-text-sec">© 2026 Zawyafi. All rights reserved.</div>
          </nav>
        </div>
      )}
    </header>
  )
}
